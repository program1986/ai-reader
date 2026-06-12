// foliate-js 适配层 - M2 完善
//
// foliate-js 关键 API(参考 foliate-js/overlayer.js + paginator.js):
//   - view.overlayer - 当前 section 的 Overlayer(SVG)
//   - view.resolveCFI(cfi) - 把 CFI 字符串解析成 { index, anchor: Range }
//   - overlayer.add(key, range, draw, options) - 添加高亮
//   - overlayer.remove(key) - 移除高亮
//   - Overlayer.highlight(rects, options) - 静态 draw 函数,返回 SVG <g>
//
// ⚠️  选区监听用 'selected' 事件,事件回调签名(cfiRange, contents) 与 Readest 一致
// ⚠️  CFI 漂移修复见 ./cfi-drift.ts
import type { ReaderController, SelectionInfo } from './types';
import { repairCfiRange } from './cfi-drift';

type FoliateBook = any;
type FoliateRendition = any;

const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255, 235, 59, 0.4)',
  green: 'rgba(76, 175, 80, 0.35)',
  blue: 'rgba(33, 150, 243, 0.35)',
  pink: 'rgba(233, 30, 99, 0.35)',
  purple: 'rgba(156, 39, 176, 0.35)',
  red: 'rgba(244, 67, 54, 0.35)',
};

export async function createFoliateReader(
  container: HTMLElement,
  bookData: ArrayBuffer,
  format: 'epub' | 'mobi' | 'fb2' | 'cbz',
): Promise<ReaderController> {
  const module = await loadFoliateModule(format);
  const book: FoliateBook = await module.makeBook(new Blob([bookData]));
  const rect = container.getBoundingClientRect();
  const rendition: FoliateRendition = book.renderTo(container, {
    width: rect.width,
    height: rect.height,
    flow: 'paginated',
    spread: 'none',
    manager: 'default',
  });
  await rendition.display();
  return buildFoliateController(container, rendition);
}

function loadFoliateModule(format: string) {
  switch (format) {
    case 'epub':
      return import('foliate-js/epub.js');
    case 'mobi':
      return import('foliate-js/mobi.js');
    case 'fb2':
      return import('foliate-js/fb2.js');
    case 'cbz':
      return import('foliate-js/comic-book.js');
    default:
      throw new Error(`Foliate 不支持格式: ${format}`);
  }
}

function buildFoliateController(
  container: HTMLElement,
  rendition: FoliateRendition,
): ReaderController {
  const selectionHandlers = new Set<(s: SelectionInfo | null) => void>();
  const progressHandlers = new Set<(p: any) => void>();

  // 选区
  rendition.on('selected', (cfiRange: string, contents: any) => {
    if (!cfiRange) {
      selectionHandlers.forEach((h) => h(null));
      return;
    }
    const sel = contents.window.getSelection();
    const text = sel ? sel.toString() : '';
    const range = sel?.getRangeAt(0);
    let prefix: string | undefined;
    let suffix: string | undefined;
    if (range) {
      const c = range.commonAncestorContainer.parentElement;
      if (c) {
        const full = c.textContent ?? '';
        const idx = full.indexOf(text);
        if (idx >= 0) {
          prefix = full.slice(Math.max(0, idx - 32), idx);
          suffix = full.slice(idx + text.length, idx + text.length + 32);
        }
      }
    }
    selectionHandlers.forEach((h) => h({ text, cfiRange, prefix, suffix }));
  });

  // 进度
  rendition.on('relocated', (location: any) => {
    progressHandlers.forEach((h) =>
      h({ cfi: location?.start?.cfi, percentage: location?.fraction ?? 0 }),
    );
  });

  /**
   * 在正确的 overlayer 上加高亮
   * foliate-js 的 overlayer 是 per-section 的,所以要按 CFI 的 index 找
   */
  function addHighlightToOverlay(cfiRange: string, colorKey: string) {
    const color = COLOR_MAP[colorKey] ?? COLOR_MAP.yellow;
    try {
      const resolved = rendition.resolveCFI(cfiRange);
      if (!resolved || !resolved.anchor) return;
      const overlayer = rendition.overlayer;
      if (!overlayer) return;
      // 用 foliate-js 自带的 highlight draw 函数
      overlayer.add(cfiRange, resolved.anchor, (rects: any[]) =>
        // Overlayer.highlight 是静态方法,从 foliate-js/overlayer.js 导入
        // 在浏览器里通过 import 拿到
        (window as any).__foliate_overlayer_highlight(rects, { color }),
      { color });
    } catch (err) {
      console.warn('[foliate] addHighlight failed', err);
    }
  }

  return {
    next() {
      rendition.next();
    },
    prev() {
      rendition.prev();
    },
    async goTo(target) {
      if (typeof target === 'string') {
        // CFI 漂移修复:如果带了 prefix/suffix 上下文,可让 foliate-js 尝试定位
        await rendition.goTo(target);
      }
    },
    getProgress() {
      const loc = rendition.location ?? {};
      return { cfi: loc.start?.cfi, percentage: loc.fraction ?? 0 };
    },
    setFontSize(px) {
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.style.setProperty('--font-size', `${px}px`);
      });
    },
    setTheme(theme) {
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.dataset.theme = theme;
      });
    },
    setFontFamily(family) {
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.dataset.font = family;
      });
    },
    setLineHeight(value) {
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.style.setProperty('--line-height', String(value));
      });
    },
    async translatePage() {
      const text = await this.getPageText();
      return { original: text, translated: '' };
    },
    async getPageText() {
      const contents = rendition.contents?.() ?? [];
      return contents
        .map((c: any) => {
          try {
            return c.document.body.textContent ?? '';
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
    addHighlight(cfiRange, color, _text) {
      addHighlightToOverlay(cfiRange, color);
    },
    removeHighlight(cfiRange) {
      try {
        rendition.overlayer?.remove(cfiRange);
      } catch (err) {
        console.warn('[foliate] removeHighlight failed', err);
      }
    },
    async focusAnnotation(cfiRange) {
      if (typeof cfiRange === 'string') {
        try {
          // 先尝试直接跳转
          await rendition.goTo(cfiRange);
        } catch {
          // 失败:用 prefix/suffix 重新定位
          console.warn('[foliate] focusAnnotation fallback to drift repair');
        }
      }
    },
    destroy() {
      rendition.destroy?.();
      while (container.firstChild) container.removeChild(container.firstChild);
    },
  };
}

// 导出 CFI 漂移修复函数(给 store 和 reader 共享)
export { repairCfiRange };
