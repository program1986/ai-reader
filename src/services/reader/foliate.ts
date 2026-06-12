// foliate-js 适配层
// 把 foliate-js 包装成统一的 ReaderController
//
// foliate-js 用法(参考 foliate-js/reader.html):
//   const book = await makeBook(file)
//   const rendition = book.renderTo(container, { width, height })
//   await rendition.display()
//   rendition.on('selected', cfiRange => ...)
//   rendition.overlay.add(cfiRange, drawFn, { fill: 'yellow' })
//
// foliate-js 的 view.js / epub.js / mobi.js / fb2.js / comic-book.js 都有 makeBook
// 共同签名是 makeBook(input) → book
import type { Book } from '@/types';
import type { ReaderController, SelectionInfo } from './types';

type FoliateBook = any;
type FoliateRendition = any;

/**
 * 创建 foliate-js 阅读器
 * @param container 挂载的 DOM 元素
 * @param bookData ArrayBuffer / Uint8Array(原始电子书字节)
 * @param format 'epub' | 'mobi' | 'fb2' | 'cbz'
 */
export async function createFoliateReader(
  container: HTMLElement,
  bookData: ArrayBuffer,
  format: 'epub' | 'mobi' | 'fb2' | 'cbz',
): Promise<ReaderController> {
  // 动态 import foliate-js 的对应模块
  // foliate-js 自身没有 default export,要从具体格式模块导入 makeBook
  const module = await loadFoliateModule(format);
  const book: FoliateBook = await module.makeBook(new Blob([bookData]));
  // 准备 rendition
  const rect = container.getBoundingClientRect();
  const rendition: FoliateRendition = book.renderTo(container, {
    width: rect.width,
    height: rect.height,
    flow: 'paginated',
    spread: 'none',
    manager: 'default',
  });
  // 监听事件
  await rendition.display();
  // ... 后续处理
  return buildFoliateController(container, book, rendition, format);
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
  book: FoliateBook,
  rendition: FoliateRendition,
  _format: string,
): ReaderController {
  // 颜色映射 foliate 用 CSS 颜色字符串
  const colorMap: Record<string, string> = {
    yellow: 'rgba(255, 235, 59, 0.4)',
    green: 'rgba(76, 175, 80, 0.35)',
    blue: 'rgba(33, 150, 243, 0.35)',
    pink: 'rgba(233, 30, 99, 0.35)',
    purple: 'rgba(156, 39, 176, 0.35)',
    red: 'rgba(244, 67, 54, 0.35)',
  };

  const selectionHandlers = new Set<(s: SelectionInfo | null) => void>();
  const progressHandlers = new Set<(p: any) => void>();

  // 选区事件
  rendition.on('selected', (cfiRange: string, contents: any) => {
    if (!cfiRange) {
      selectionHandlers.forEach((h) => h(null));
      return;
    }
    // 提取选中文本
    const sel = contents.window.getSelection();
    const text = sel ? sel.toString() : '';
    // 提取 prefix/suffix(选区两端各 32 字符)
    const range = sel?.getRangeAt(0);
    let prefix: string | undefined;
    let suffix: string | undefined;
    if (range) {
      const container = range.commonAncestorContainer.parentElement;
      if (container) {
        const fullText = container.textContent ?? '';
        const selText = sel?.toString() ?? '';
        const idx = fullText.indexOf(selText);
        if (idx >= 0) {
          prefix = fullText.slice(Math.max(0, idx - 32), idx);
          suffix = fullText.slice(idx + selText.length, idx + selText.length + 32);
        }
      }
    }
    selectionHandlers.forEach((h) => h({ text, cfiRange, prefix, suffix }));
  });

  // 进度事件(foliate-js 在翻页后通过 relocate 给出当前位置)
  rendition.on('relocated', (location: any) => {
    const percentage = location?.fraction ?? 0;
    const cfi = location?.start?.cfi;
    progressHandlers.forEach((h) => h({ cfi, percentage }));
  });

  return {
    next() {
      rendition.next();
    },
    prev() {
      rendition.prev();
    },
    async goTo(target) {
      if (typeof target === 'string') {
        await rendition.goTo(target);
      }
    },
    getProgress() {
      const loc = rendition.location ?? {};
      return {
        cfi: loc.start?.cfi,
        percentage: loc.fraction ?? 0,
      };
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
      const fontVar = family === 'serif' ? 'serif' : family === 'sans' ? 'sans' : 'system';
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.dataset.font = fontVar;
      });
    },
    setLineHeight(value) {
      rendition.contents?.forEach((c: any) => {
        c.document.documentElement.style.setProperty('--line-height', String(value));
      });
    },
    async translatePage() {
      // 调用 AI 翻译当前页文本
      // M4 实现
      const text = await this.getPageText();
      return { original: text, translated: '' };
    },
    async getPageText() {
      // foliate-js 的 contents 是当前可见的 iframe 列表
      const contents = rendition.contents();
      if (!contents || contents.length === 0) return '';
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
      // foliate-js 的 overlayer 接受 cfiRange 和一个 draw 函数
      // 这里用纯色矩形
      rendition.annotations.add(cfiRange, cfiRange, {
        fill: colorMap[color] ?? colorMap.yellow,
      });
    },
    removeHighlight(cfiRange) {
      rendition.annotations.remove(cfiRange);
    },
    async focusAnnotation(cfiRange) {
      if (typeof cfiRange === 'string') {
        await rendition.goTo(cfiRange);
      }
    },
    destroy() {
      rendition.destroy?.();
      // 移除 container 内容
      while (container.firstChild) container.removeChild(container.firstChild);
    },
  };
}
