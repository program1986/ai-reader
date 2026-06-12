// pdfjs-dist 适配层 - M2 完善
// M1 基础上加上:
//   - addHighlight 真实实现(在 PDF 页面覆盖 div)
//   - focusAnnotation 真实实现
//   - 选择触发选区弹窗的逻辑保持
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ReaderController, SelectionInfo } from './types';
import { findRangeByContext } from './cfi-drift';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const COLOR_MAP: Record<string, string> = {
  yellow: 'rgba(255, 235, 59, 0.4)',
  green: 'rgba(76, 175, 80, 0.35)',
  blue: 'rgba(33, 150, 243, 0.35)',
  pink: 'rgba(233, 30, 99, 0.35)',
  purple: 'rgba(156, 39, 176, 0.35)',
  red: 'rgba(244, 67, 54, 0.35)',
};

export async function createPdfReader(
  container: HTMLElement,
  bookData: ArrayBuffer,
): Promise<ReaderController> {
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-wrapper';
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;overflow-y:auto;';
  container.appendChild(wrapper);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bookData) });
  const pdf = await loadingTask.promise;
  const numPages: number = pdf.numPages;

  let scale = 1.5;
  let currentPage = 1;
  const pageTextLayers: HTMLDivElement[] = [];
  const pageHighlightLayers: HTMLDivElement[] = [];
  const pageWraps: HTMLDivElement[] = [];

  // 高亮存储:key = "page:x,y,w,h"
  const highlights = new Map<string, HTMLDivElement>();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.cssText = 'display:block;width:100%;height:auto;';
    canvas.dataset.page = String(i);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context 创建失败');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textContent = await page.getTextContent();
    const textLayer = document.createElement('div');
    textLayer.className = 'pdf-text-layer';
    textLayer.style.cssText = `position:absolute;left:0;top:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden;opacity:0.1;user-select:text;`;
    textLayer.dataset.page = String(i);
    try {
      const textLayerFactory = new (pdfjsLib as any).TextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport,
      });
      await textLayerFactory.render();
    } catch {
      // 旧版 pdfjs 兼容
      const items = (textContent as any).items ?? [];
      for (const it of items) {
        const span = document.createElement('span');
        span.textContent = it.str ?? '';
        span.style.cssText = `position:absolute;left:${it.transform[4]}px;top:${it.transform[5] - it.height}px;font-size:${it.height}px;color:transparent;`;
        textLayer.appendChild(span);
      }
    }

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

    pageTextLayers.push(textLayer);
    pageHighlightLayers.push(hlLayer);
    pageWraps.push(pageWrap);
  }

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
    let pageEl: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    while (pageEl && !pageEl.dataset?.page) pageEl = pageEl.parentElement;
    if (!pageEl) return;
    const page = Number(pageEl.dataset.page);
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
    const textLayer = pageTextLayers[page - 1];
    const fullText = textLayer?.textContent ?? '';
    const idx = fullText.indexOf(text);
    const prefix = idx >= 0 ? fullText.slice(Math.max(0, idx - 32), idx) : undefined;
    const suffix = idx >= 0 ? fullText.slice(idx + text.length, idx + text.length + 32) : undefined;
    selectionHandlers.forEach((h) => h({ text, page, rects, prefix, suffix }));
  });

  wrapper.addEventListener('scroll', () => {
    const wrapperRect = wrapper.getBoundingClientRect();
    let bestPage = 1;
    let bestDist = Infinity;
    for (let i = 0; i < pageTextLayers.length; i++) {
      const r = pageTextLayers[i].getBoundingClientRect();
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

  function encodeKey(page: number, rect: { x: number; y: number; width: number; height: number }) {
    return `pdf:${page}:${rect.x.toFixed(0)},${rect.y.toFixed(0)},${rect.width.toFixed(0)},${rect.height.toFixed(0)}`;
  }

  function drawRectDiv(rect: { x: number; y: number; width: number; height: number }, color: string) {
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;background:${color};border-radius:2px;pointer-events:none;`;
    return div;
  }

  return {
    next() {
      if (currentPage < numPages) {
        const next = pageWraps[currentPage];
        next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage++;
      }
    },
    prev() {
      if (currentPage > 1) {
        const prev = pageWraps[currentPage - 2];
        prev?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage--;
      }
    },
    async goTo(target) {
      if (typeof target === 'number') {
        const w = pageWraps[target - 1];
        w?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage = target;
      }
    },
    getProgress() {
      return { page: currentPage, percentage: currentPage / numPages };
    },
    setFontSize(_px) {},
    setTheme(_theme) {},
    setFontFamily(_f) {},
    setLineHeight(_v) {},
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
      // cfiRange 占位接口 - 实际由 reader 通过 addHighlightByLocator 调
    },
    /**
     * PDF 专属:按 locator 直接画高亮
     * 用于 reader 启动时把已存的 annotation 重画出来
     */
    addHighlightByLocator(page: number, rects: Array<{ x: number; y: number; width: number; height: number }>, colorKey: string) {
      const color = COLOR_MAP[colorKey] ?? COLOR_MAP.yellow;
      const layer = pageHighlightLayers[page - 1];
      if (!layer) return;
      for (const rect of rects) {
        const div = drawRectDiv(rect, color);
        const key = encodeKey(page, rect);
        highlights.set(key, div);
        layer.appendChild(div);
      }
    },
    removeHighlightByLocator(page: number, rects: Array<{ x: number; y: number; width: number; height: number }>) {
      for (const rect of rects) {
        const key = encodeKey(page, rect);
        const div = highlights.get(key);
        if (div) {
          div.remove();
          highlights.delete(key);
        }
      }
    },
    removeHighlight(_cfiRange) {},
    async focusAnnotation(target) {
      if (typeof target === 'number') {
        const w = pageWraps[target - 1];
        w?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage = target;
      } else if (typeof target === 'string' && target.startsWith('pdf:')) {
        // 形如 "pdf:5:120,80,200,30"
        const parts = target.split(':');
        const page = Number(parts[1]);
        if (page >= 1 && page <= numPages) {
          const w = pageWraps[page - 1];
          w?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          currentPage = page;
        }
      }
    },
    /**
     * 重新载入所有 annotation
     * 由 reader 在 mount 完时调用
     */
    repaintAll(annotations: Array<{ page?: number; rects?: any[]; color: string }>) {
      for (const a of annotations) {
        if (a.page && a.rects && a.rects.length > 0) {
          this.addHighlightByLocator(a.page, a.rects, a.color);
        }
      }
    },
    destroy() {
      wrapper.remove();
    },
  };
}

// 导出辅助函数,供 CFI 漂移修复用
export { findRangeByContext };
