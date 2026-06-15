// foliate-js 适配层 - 绕过 view.js makeBook 直连
//
// M1 原本的 foliate.ts 用 `book.renderTo(container, ...)` + `rendition.display()`
// 这是 foliate-js v1 的旧 API,现在的 foliate-js 改成了 <foliate-view> custom element。
//
// view.js 里的 makeBook() 又会调动态 `import('./vendor/zip.js')`,在 iOS webview 里
// 这条动态 import 链会挂死。直接绕开:
//   1. 用 @zip.js/zip.js 构造 foliate-js EPUB 期望的 loader
//   2. `new EPUB(loader).init()` 拿 book
//   3. 创建 <foliate-view> 元素,`view.open(book)` (book 不是 File,不会再走 makeBook)
//   4. view.renderer 是 <foliate-paginator>,负责翻页/高亮
import type { ReaderController, SelectionInfo } from './types';
import { wlog } from '../webview-log';

type FoliateBook = any;
type FoliateView = any;

const COLOR_MAP: Record<string, string> = {
  // foliate Overlayer.highlight 把 fill 写进 <rect> 的 fill 属性,再用 CSS var
  // --overlayer-highlight-opacity(默认 0.3)给 <g> 加 opacity
  // 实际可见不透明度 = fill alpha × 0.3
  // 之前用 0.4 → 12% 实际,白底上几乎不可见
  // 改用 1.0 透明度让 foliate 的 0.3 变成主不透明度,既符合 foliate 设计又有可见度
  yellow: 'rgba(255, 235, 59, 1.0)',
  green: 'rgba(76, 175, 80, 1.0)',
  blue: 'rgba(33, 150, 243, 1.0)',
  pink: 'rgba(233, 30, 99, 1.0)',
  purple: 'rgba(156, 39, 176, 1.0)',
  red: 'rgba(244, 67, 54, 1.0)',
};

/**
 * 用 @zip.js/zip.js 直接构造 foliate-js EPUB 期望的 loader 接口
 * (entries, loadText, loadBlob, getSize) —— 等价于 view.js 的 makeZipLoader
 */
async function makeZipLoaderFromBytes(bytes: Uint8Array): Promise<{
  entries: Array<{ filename: string; directory: boolean; uncompressedSize: number }>;
  loadText: (name: string) => Promise<string | null>;
  loadBlob: (name: string, type?: string) => Promise<Blob | null>;
  getSize: (name: string) => number;
}> {
  await wlog('info', `makeZipLoaderFromBytes: loading @zip.js/zip.js`);
  const { configure, ZipReader, BlobReader, TextWriter, BlobWriter } =
    await import('@zip.js/zip.js');
  configure({ useWebWorkers: false });
  await wlog('info', `makeZipLoaderFromBytes: zip.js configured`);

  // 转 Blob,直接给 ZipReader
  const blob = new Blob([bytes as BlobPart]);
  const reader = new ZipReader(new BlobReader(blob));
  const rawEntries = await reader.getEntries();
  await wlog('info', `makeZipLoaderFromBytes: got ${rawEntries.length} zip entries`);

  // entries 数组只保留 foliate-js 关心的字段
  const entries = rawEntries.map((e: any) => ({
    filename: e.filename,
    directory: !!e.directory,
    uncompressedSize: e.uncompressedSize ?? 0,
  }));
  const map = new Map(entries.map((e) => [e.filename, e]));

  const loadText = async (name: string) => {
    const r = rawEntries.find((x: any) => x.filename === name) as any;
    if (!r || r.directory) return null;
    return await r.getData(new TextWriter());
  };

  const loadBlob = async (name: string, type?: string) => {
    const r = rawEntries.find((x: any) => x.filename === name) as any;
    if (!r || r.directory) return null;
    return await r.getData(new BlobWriter(type));
  };

  const getSize = (name: string) =>
    (map.get(name) as any)?.uncompressedSize ?? 0;

  return { entries, loadText, loadBlob, getSize };
}

export async function createFoliateReader(
  container: HTMLElement,
  bookData: ArrayBuffer | Uint8Array,
  format: 'epub' | 'mobi' | 'fb2' | 'cbz',
): Promise<ReaderController> {
  await wlog('info', `createFoliateReader: start format=${format} bytes=${bookData.byteLength}`);

  // 统一成 Uint8Array
  const u8 = bookData instanceof Uint8Array
    ? new Uint8Array(bookData.buffer.slice(bookData.byteOffset, bookData.byteOffset + bookData.byteLength))
    : new Uint8Array(bookData);

  // 1) 直接构造 loader (绕过 view.js)
  const loader = await makeZipLoaderFromBytes(u8);
  await wlog('info', 'createFoliateReader: loader ready');

  // 2) 走 EPUB 类
  const { EPUB } = await import('foliate-js/epub.js');
  const book: FoliateBook = await new EPUB(loader).init();
  await wlog('info', `createFoliateReader: EPUB.init() done, title="${book.metadata?.title}"`);

  // 2.5) 静态 import view.js + paginator.js + progress.js + overlayer.js 等,
  // 让 foliate-view custom element 注册好,view.open() 里的动态 import 不会挂
  // 这些都是相对 import,经过 vite 静态分析会变成单独的 chunk
  await wlog('info', 'createFoliateReader: prewarming view.js');
  await import('foliate-js/view.js');
  await wlog('info', 'createFoliateReader: view.js loaded');
  // 主动 import paginator 和 progress,避免 view.open() 里动态 import 卡住
  await import('foliate-js/paginator.js');
  await wlog('info', 'createFoliateReader: paginator.js loaded');
  await import('foliate-js/progress.js');
  await wlog('info', 'createFoliateReader: progress.js loaded');
  // 预热 overlayer (draw-annotation 事件里要拿 Overlayer.highlight 函数)
  await import('foliate-js/overlayer.js');
  await wlog('info', 'createFoliateReader: overlayer.js loaded');

  return buildFoliateController(container, book);
}

function buildFoliateController(
  container: HTMLElement,
  book: FoliateBook,
): ReaderController {
  const selectionHandlers = new Set<(s: SelectionInfo | null) => void>();
  const progressHandlers = new Set<(p: any) => void>();
  // doc -> 该 doc 对应的 section index,foliate-js 用它生成 CFI
  const docToIndex = new Map<Document, number>();
  // 持久化的高亮列表:{ cfiRange, color }
  // 在每段 load 完后,重画落在该 section index 上的高亮 (用户翻页/重启后)
  const storedHighlights: Array<{ cfiRange: string; color: string }> = [];

  // 3) 创建 <foliate-view>
  // foliate-view 是个 custom element,view.open() 时会自动注册 paginator 子元素
  // 必须先静态 import view.js,触发 customElements.define('foliate-view', View)
  // 注意:view.js 顶部有 4 个静态 import (epubcfi/progress/overlayer/text-walker),
  // 不会触发 view.js 内部的动态 import (那是 makeBook / isPDF / isMOBI 等的延迟加载)
  // view.open(book) 里还会动态 import './paginator.js' - 我们用 dynamic import prewarm
  // 把 paginator / fixed-layout / progress 提前 import,避免 iOS webview 动态 import 挂死
  const view: FoliateView = document.createElement('foliate-view');
  view.style.display = 'block';
  view.style.width = '100%';
  view.style.height = '100%';
  container.appendChild(view);

  // foliate-js 内部用 ResizeObserver 监听 container,container 必须有尺寸
  const rect = container.getBoundingClientRect();
  if (rect.width && rect.height) {
    view.style.width = `${rect.width}px`;
    view.style.height = `${rect.height}px`;
  }

  // 设置默认样式 (字号/行距/字体/主题)
  const styleVars = `
    :root {
      --font-size: 16px;
      --line-height: 1.6;
    }
  `;
  view.renderer?.setStyles?.(['', styleVars]);

  // 进度
  view.addEventListener('relocate', (e: any) => {
    const d = e.detail ?? {};
    progressHandlers.forEach((h) =>
      h({ cfi: d.cfi, page: d.location?.current, percentage: d.fraction ?? 0 }),
    );
  });

  // 监听渲染器 load 事件,看 content 是否真的加载进来
  view.addEventListener('load', (e: any) => {
    const d = e.detail ?? {};
    wlog('info', `foliate-view: load event index=${d.index}`).catch(() => {});
    // 注意:load 时 overlayer 还没建好,真正的 re-apply 在 create-overlayer 里做
    const contents = view.renderer?.getContents?.() ?? [];
    wlog('info', `foliate-view: contents after load, count=${contents.length}`).catch(() => {});
    for (let i = 0; i < Math.min(contents.length, 3); i++) {
      const c = contents[i];
      if (!c.doc) continue;
      const body = c.doc.body;
      const r = c.doc.documentElement.getBoundingClientRect();
      const bodyStyle = c.doc.defaultView?.getComputedStyle?.(body);
      const text = (body.textContent || '').slice(0, 80);
      wlog('info', `foliate-view: [${i}] idx=${c.index} body=${body.children.length} kids txt=${(body.textContent||'').length} viewport=${r.width}x${r.height} bg=${bodyStyle?.backgroundColor} color=${bodyStyle?.color} text="${text.replace(/\s+/g, ' ')}"`).catch(() => {});
    }
    // 算一下 view 元素的实际尺寸
    const vR = view.getBoundingClientRect();
    const cR = container.getBoundingClientRect();
    wlog('info', `foliate-view: view=${vR.width}x${vR.height} container=${cR.width}x${cR.height}`).catch(() => {});
    // 检查 paginator 内部结构
    const pag = view.renderer;
    if (pag) {
      const pR = pag.getBoundingClientRect();
      wlog('info', `foliate-view: paginator=${pR.width}x${pR.height} flow=${pag.getAttribute('flow')} spread=${pag.getAttribute('spread')}`).catch(() => {});
    }
  });

  // draw-annotation 事件:foliate 解算出 CFI → Range 后回调,返回 draw 函数
  // 必须主动调 draw(Overlayer.highlight, { color }) 才会真正把高亮画到页面上!
  // (foliate-js view.js 负责解析,实际渲染交由 listener 完成)
  view.addEventListener('draw-annotation', (e: any) => {
    const { draw, annotation } = e.detail ?? {};
    if (draw && annotation) {
      try {
        // 动态 import overlayer.js 拿 Overlayer.highlight 函数
        import('foliate-js/overlayer.js').then(({ Overlayer }) => {
          try {
            draw(Overlayer.highlight, { color: annotation.color });
            wlog('info', `foliate-view: draw-annotation rendered value="${annotation.value}" color=${annotation.color}`).catch(
              () => {},
            );
          } catch (err) {
            wlog('warn', `draw call failed: ${(err as Error).message}`).catch(() => {});
          }
        }).catch((err) => {
          wlog('warn', `overlayer.js import failed: ${(err as Error).message}`).catch(() => {});
        });
      } catch (err) {
        wlog('warn', `draw-annotation handler failed: ${(err as Error).message}`).catch(() => {});
      }
    }
  });

  // 选区:监听每个内容 doc 的 selectionchange
  // 用 view.getCFI(index, range) 把 Range 转成 CFI,这样高亮可以持久化
  const attachSelectionListener = (doc: Document) => {
    doc.addEventListener('selectionchange', () => {
      const sel = doc.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        selectionHandlers.forEach((h) => h(null));
        return;
      }
      const range = sel.getRangeAt(0);
      const text = sel.toString();
      if (!text) {
        selectionHandlers.forEach((h) => h(null));
        return;
      }
      const index = docToIndex.get(doc);
      let cfiRange: string | undefined;
      if (typeof index === 'number' && typeof view.getCFI === 'function') {
        try {
          cfiRange = view.getCFI(index, range);
        } catch (err) {
          wlog('warn', `selection: getCFI failed: ${(err as Error).message}`).catch(() => {});
        }
      }
      // prefix/suffix 用来做 CFI 漂移修复 (文本可能有微小变化)
      const prefix = (range.startContainer.textContent ?? '').slice(
        Math.max(0, range.startOffset - 24),
        range.startOffset,
      );
      const suffix = (range.endContainer.textContent ?? '').slice(
        range.endOffset,
        range.endOffset + 24,
      );
      selectionHandlers.forEach((h) =>
        h({ text, cfiRange, prefix, suffix }),
      );
    });
  };

  // 监听 overlayer 创建,顺带挂 selection listener
  // ⚠️ create-overlayer 是 renderer (<foliate-paginator>) 派发的,view 内部捕获了
  //    但**没有 re-emit**到 view 上,所以必须在 view.renderer 上直接监听
  // 在这里重画所有 storedHighlights,确保重启/翻页后高亮都恢复
  // 注册时机:view.open() 之后 (renderer 是 open 过程中才创建的)
  const registerCreateOverlayerListener = () => {
    const renderer: any = (view as any).renderer;
    if (!renderer || typeof renderer.addEventListener !== 'function') return;
    renderer.addEventListener('create-overlayer', (e: any) => {
      const doc = e.detail?.doc;
      const index = e.detail?.index;
      if (typeof index === 'number' && doc) {
        docToIndex.set(doc, index);
      }
      if (doc) attachSelectionListener(doc);
      if (storedHighlights.length > 0) {
        wlog(
          'info',
          `foliate-view: re-applying ${storedHighlights.length} highlight(s) on create-overlayer index=${index}`,
        ).catch(() => {});
        for (const h of storedHighlights) {
          try {
            view.addAnnotation({ value: h.cfiRange, color: h.color });
          } catch (err) {
            wlog('warn', `re-apply highlight failed: ${(err as Error).message}`).catch(() => {});
          }
        }
      }
    });
  };

  // 监听 load,这里拿到 doc (EPUB.init 后的所有内容)
  view.addEventListener('load', (e: any) => {
    const doc = e.detail?.doc;
    const index = e.detail?.index;
    if (typeof index === 'number' && doc) {
      docToIndex.set(doc, index);
    }
    if (doc) attachSelectionListener(doc);
  });

  // 4) view.open(book) -- book 是 EPUB.init() 的返回值,不是 File,不会再走 makeBook
  // 注意:view.open() 内部会动态 import './paginator.js',在 iOS webview 里可能挂死
  // 手动加超时和详细 log 便于定位
  const openPromise = view.open(book);
  if (openPromise && typeof openPromise.then === 'function') {
    openPromise
      .then(() => {
        wlog('info', 'createFoliateReader: view.open() resolved, triggering first section').catch(() => {});
        // view.open() 完成后,view.renderer (<foliate-paginator>) 才存在
        // 注册 create-overlayer 监听器(关键! foliate-view 不会 re-emit 这个事件)
        registerCreateOverlayerListener();
        // view.open() 只挂载 renderer,不会自动加载第一段,需要手动触发
        try {
          if (view.renderer?.firstSection) {
            view.renderer.firstSection();
          } else if (view.next) {
            view.next();
          }
        } catch (err) {
          wlog('error', 'createFoliateReader: trigger first section failed', err).catch(() => {});
        }
      })
      .catch((err: any) => wlog('error', 'createFoliateReader: view.open() rejected', err));
  } else {
    wlog('warn', 'createFoliateReader: view.open() did not return a promise');
  }
  wlog('info', 'createFoliateReader: view.open() invoked (async started)');

  return {
    next() {
      view.next?.();
    },
    prev() {
      view.prev?.();
    },
    async goTo(target) {
      if (typeof target === 'string' && target) {
        try {
          await view.goTo(target);
        } catch (err) {
          await wlog('warn', `goTo failed: ${(err as Error).message}`);
        }
      }
    },
    getProgress() {
      // view.history.lastLocation 拿不到,从 renderer 当前位置推
      const contents = view.renderer?.getContents?.() ?? [];
      const first = contents[0];
      return {
        cfi: undefined,
        page: first?.index ?? 0,
        percentage: 0,
      };
    },
    setFontSize(px) {
      const css = `:root { --font-size: ${px}px; }`;
      view.renderer?.setStyles?.(['', css]);
    },
    setTheme(theme) {
      // 主题通过 dataset
      const contents = view.renderer?.getContents?.() ?? [];
      contents.forEach((c: any) => {
        c.doc?.documentElement?.setAttribute('data-theme', theme);
      });
    },
    setFontFamily(family) {
      const contents = view.renderer?.getContents?.() ?? [];
      contents.forEach((c: any) => {
        c.doc?.documentElement?.setAttribute('data-font', family);
      });
    },
    setLineHeight(value) {
      const css = `:root { --line-height: ${value}; }`;
      view.renderer?.setStyles?.(['', css]);
    },
    async translatePage() {
      const text = await this.getPageText();
      return { original: text, translated: '' };
    },
    async getPageText() {
      const contents = view.renderer?.getContents?.() ?? [];
      return contents
        .map((c: any) => {
          try {
            return c.doc?.body?.textContent ?? '';
          } catch {
            return '';
          }
        })
        .join('\n');
    },
    onSelection(h) {
      selectionHandlers.add(h);
      return () => selectionHandlers.delete(h);
    },
    onProgress(h) {
      progressHandlers.add(h);
      return () => progressHandlers.delete(h);
    },
    addHighlight(cfiRange, color, text) {
      if (!cfiRange) {
        wlog('warn', `addHighlight: empty cfiRange, text="${(text || '').slice(0, 40)}"`).catch(
          () => {},
        );
        return;
      }
      const c = COLOR_MAP[color] ?? COLOR_MAP.yellow;
      // 存进持久化列表(去重),翻页/重启后靠 load 事件重画
      if (!storedHighlights.some((h) => h.cfiRange === cfiRange)) {
        storedHighlights.push({ cfiRange, color: c });
      } else {
        // 已存在,只更新颜色
        const ex = storedHighlights.find((h) => h.cfiRange === cfiRange);
        if (ex) ex.color = c;
      }
      try {
        const ret = view.addAnnotation({ value: cfiRange, color: c });
        if (ret && typeof ret.then === 'function') {
          ret
            .then((r: any) =>
              wlog('info', `addHighlight OK cfiRange=${cfiRange} index=${r?.index}`).catch(
                () => {},
              ),
            )
            .catch((err: any) =>
              wlog('warn', `addAnnotation async reject: ${err?.message ?? err}`).catch(() => {}),
            );
        } else {
          wlog('info', `addHighlight sync cfiRange=${cfiRange} ret=${JSON.stringify(ret)}`).catch(
            () => {},
          );
        }
      } catch (err) {
        wlog('warn', `addAnnotation failed: ${(err as Error).message}`).catch(() => {});
      }
    },
    removeHighlight(cfiRange) {
      if (!cfiRange) return;
      // 从持久化列表里也清掉
      const idx = storedHighlights.findIndex((h) => h.cfiRange === cfiRange);
      if (idx >= 0) storedHighlights.splice(idx, 1);
      try {
        view.deleteAnnotation({ value: cfiRange });
        wlog('info', `removeHighlight cfiRange=${cfiRange}`).catch(() => {});
      } catch (err) {
        wlog('warn', `deleteAnnotation failed: ${(err as Error).message}`).catch(() => {});
      }
    },
    async focusAnnotation(cfiRange) {
      if (typeof cfiRange === 'string' && cfiRange) {
        try {
          await view.goTo(cfiRange);
        } catch (err) {
          wlog('warn', `focusAnnotation failed: ${(err as Error).message}`);
        }
      }
    },
    // 临时暴露:给 BookReader 自测用
    getView() {
      return view;
    },
    getStoredHighlights() {
      return storedHighlights.slice();
    },
    destroy() {
      try {
        view.close?.();
      } catch {
        // ignore
      }
      if (view.parentNode) view.parentNode.removeChild(view);
      while (container.firstChild) container.removeChild(container.firstChild);
    },
  };
}

// re-export CFI 漂移修复占位(给 store 引用,保持兼容)
export { repairCfiRange } from './cfi-drift';
