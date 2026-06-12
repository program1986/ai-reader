// pdfjs-dist 适配层
//
// pdfjs-dist 5.x 典型用法:
//   import * as pdfjsLib from 'pdfjs-dist'
//   pdfjsLib.GlobalWorkerOptions.workerSrc = '...'
//   const loadingTask = pdfjsLib.getDocument({ data: bytes })
//   const pdf = await loadingTask.promise
//   const page = await pdf.getPage(n)
//   const viewport = page.getViewport({ scale })
//   page.render({ canvasContext, viewport })
//
// ⚠️  PDF 没有 CFI。位置用 "page:rects" 表示。
// ⚠️  PDF 划线 / 批注 是 div 覆盖在 canvas 之上,绝对定位。
//
// 这个实现参考了 Readest 的 PDF 渲染管线 + foliate-js/pdf.js 的模式
// 详细的高亮算法(页面坐标系、scroll 同步)参考 Readest:
//   apps/readest-app/src/services/reader/pdf，翻页/渲染/pdfSelection.ts
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Book } from '@/types';
import type { ReaderController, SelectionInfo } from './types';

// worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function createPdfReader(
  container: HTMLElement,
  bookData: ArrayBuffer,
): Promise<ReaderController> {
  // 准备 DOM
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-wrapper';
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;overflow-y:auto;';
  const overlay = document.createElement('div');
  overlay.className = 'pdf-overlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
  container.appendChild(wrapper);
  wrapper.appendChild(overlay);

  // 加载 PDF
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bookData) });
  const pdf = await loadingTask.promise;
  const numPages: number = pdf.numPages;

  // 当前缩放
  let scale = 1.5;
  let currentPage = 1;

  // 渲染所有页(canvas + 文本层)
  const pageCanvases: HTMLCanvasElement[] = [];
  const pageTextLayers: HTMLDivElement[] = [];
  const pageHighlights: HTMLDivElement[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.cssText = `display:block;width:100%;height:auto;`;
    canvas.dataset.page = String(i);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 canvas 2d context');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // 文本层:用于选择
    const textContent = await page.getTextContent();
    const textLayer = document.createElement('div');
    textLayer.className = 'pdf-text-layer';
    textLayer.style.cssText = `
      position:absolute;left:0;top:0;
      width:${viewport.width}px;height:${viewport.height}px;
      overflow:hidden;opacity:0.1;
      user-select:text;
    `;
    textLayer.dataset.page = String(i);

    // 用 pdfjs 的文本层 helper
    const textLayerFactory = new (pdfjsLib as any).TextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport,
    });
    await textLayerFactory.render();

    const pageWrap = document.createElement('div');
    pageWrap.className = 'pdf-page';
    pageWrap.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:8px auto;`;
    pageWrap.dataset.page = String(i);
    pageWrap.appendChild(canvas);
    pageWrap.appendChild(textLayer);
    const hlLayer = document.createElement('div');
    hlLayer.className = 'pdf-highlight-layer';
    hlLayer.style.cssText = `position:absolute;left:0;top:0;width:${viewport.width}px;height:${viewport.height}px;pointer-events:none;`;
    pageWrap.appendChild(hlLayer);
    wrapper.appendChild(pageWrap);

    pageCanvases.push(canvas);
    pageTextLayers.push(textLayer);
    pageHighlights.push(hlLayer);
  }

  // 选区监听 + 进度
  const selectionHandlers = new Set<(s: SelectionInfo | null) => void>();
  const progressHandlers = new Set<(p: any) => void>();

  wrapper.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      selectionHandlers.forEach((h) => h(null));
      return;
    }
    const range = sel.getRangeAt(0);
    const text = sel.toString();
    // 找选区所在的 page
    let pageEl: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    while (pageEl && !pageEl.dataset?.page) {
      pageEl = pageEl.parentElement;
    }
    if (!pageEl) return;
    const page = Number(pageEl.dataset.page);
    // 计算选区相对 page 的 rect
    const pageRect = pageEl.getBoundingClientRect();
    const rangeRects = range.getClientRects();
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < rangeRects.length; i++) {
      const r = rangeRects[i];
      rects.push({
        x: r.left - pageRect.left,
        y: r.top - pageRect.top,
        width: r.width,
        height: r.height,
      });
    }
    // 提取 prefix/suffix
    const textLayer = pageTextLayers[page - 1];
    const fullText = textLayer.textContent ?? '';
    const idx = fullText.indexOf(text);
    const prefix = idx >= 0 ? fullText.slice(Math.max(0, idx - 32), idx) : undefined;
    const suffix = idx >= 0 ? fullText.slice(idx + text.length, idx + text.length + 32) : undefined;
    selectionHandlers.forEach((h) => h({ text, page, rects, prefix, suffix }));
  });

  wrapper.addEventListener('scroll', () => {
    // 找到当前最靠近视口顶部的页
    const wrapperRect = wrapper.getBoundingClientRect();
    let bestPage = 1;
    let bestDist = Infinity;
    for (let i = 0; i < pageCanvases.length; i++) {
      const r = pageCanvases[i].getBoundingClientRect();
      const dist = Math.abs(r.top - wrapperRect.top);
      if (dist < bestDist) {
        bestDist = dist;
        bestPage = i + 1;
      }
    }
    if (bestPage !== currentPage) {
      currentPage = bestPage;
      progressHandlers.forEach((h) =>
        h({ page: currentPage, percentage: currentPage / numPages }),
      );
    }
  });

  // 颜色映射
  const colorMap: Record<string, string> = {
    yellow: 'rgba(255, 235, 59, 0.4)',
    green: 'rgba(76, 175, 80, 0.35)',
    blue: 'rgba(33, 150, 243, 0.35)',
    pink: 'rgba(233, 30, 99, 0.35)',
    purple: 'rgba(156, 39, 176, 0.35)',
    red: 'rgba(244, 67, 54, 0.35)',
  };

  // 把"page:rect" 编码成 key
  const encodeKey = (page: number, rect: { x: number; y: number; width: number; height: number }) =>
    `pdf:${page}:${rect.x.toFixed(0)},${rect.y.toFixed(0)},${rect.width.toFixed(0)},${rect.height.toFixed(0)}`;

  return {
    next() {
      if (currentPage < numPages) {
        const next = pageCanvases[currentPage];
        next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage++;
      }
    },
    prev() {
      if (currentPage > 1) {
        const prev = pageCanvases[currentPage - 2];
        prev?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage--;
      }
    },
    async goTo(target) {
      if (typeof target === 'number') {
        const canvas = pageCanvases[target - 1];
        canvas?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage = target;
      }
    },
    getProgress() {
      return { page: currentPage, percentage: currentPage / numPages };
    },
    setFontSize(_px) {
      // PDF 不支持字号调整
    },
    setTheme(_theme) {
      // PDF 不支持主题
    },
    setFontFamily(_f) {
      // PDF 不支持字体
    },
    setLineHeight(_v) {
      // PDF 不支持行距
    },
    async translatePage() {
      const text = await this.getPageText();
      return { original: text, translated: '' };
    },
    async getPageText() {
      const textLayer = pageTextLayers[currentPage - 1];
      return textLayer?.textContent ?? '';
    },
    onSelection(h) {
      selectionHandlers.add(h);
      return () => selectionHandlers.delete(h);
    },
    onProgress(h) {
      progressHandlers.add(h);
      return () => progressHandlers.delete(h);
    },
    addHighlight(_cfiRange, color, _text) {
      // PDF 划线:用 _cfiRange 解码成 "page:rects" 是不准确的(cfiRange 是 foliate-js 的格式)
      // 实际存储:annotation.locator.page + annotation.locator.rects
      // 这里用 selectionHandlers 调用的临时存储
      // 实际实现见 M2
    },
    removeHighlight(_cfiRange) {
      // 见 M2
    },
    async focusAnnotation(target, _color, _text) {
      if (typeof target === 'number') {
        const canvas = pageCanvases[target - 1];
        canvas?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    destroy() {
      wrapper.remove();
    },
  };
}
