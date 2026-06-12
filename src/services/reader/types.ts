// 阅读器共享类型
import type { AnnotationColor } from '@/types';

export interface SelectionInfo {
  text: string;
  /** CFI range (EPUB/FB2/CBZ) */
  cfiRange?: string;
  /** PDF 页码 */
  page?: number;
  /** 选区在页面上的矩形(用于 PDF 和 fall-back) */
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  /** 选区前后的文字锚点(用于定位漂移修复) */
  prefix?: string;
  suffix?: string;
}

export interface ReaderController {
  /** 翻到下一页 */
  next(): void;
  /** 翻到上一页 */
  prev(): void;
  /** 跳转到指定位置 */
  goTo(cfiOrPage: string | number): Promise<void>;
  /** 当前进度 */
  getProgress(): { cfi?: string; page?: number; percentage: number };
  /** 设置字号 */
  setFontSize(px: number): void;
  /** 设置主题 */
  setTheme(theme: 'light' | 'dark' | 'sepia'): void;
  /** 设置字体族 */
  setFontFamily(family: 'serif' | 'sans' | 'system'): void;
  /** 设置行距 */
  setLineHeight(value: number): void;
  /** 整页翻译:用 AI 翻译当前页/章节 */
  translatePage(): Promise<{ original: string; translated: string }>;
  /** 渲染当前页到文本(EPUB/FB2 简单拿 textContent) */
  getPageText(): Promise<string>;
  /** 监听选区变化 */
  onSelection(handler: (sel: SelectionInfo | null) => void): () => void;
  /** 监听进度变化 */
  onProgress(handler: (p: { cfi?: string; page?: number; percentage: number }) => void): () => void;
  /** 在指定 CFI/page 处添加高亮 */
  addHighlight(cfiRange: string, color: AnnotationColor, text: string): void;
  /** 移除高亮 */
  removeHighlight(cfiRange: string): void;
  /** 跳转到 annotation 位置 */
  focusAnnotation(cfiRange: string | number, color: AnnotationColor, text: string): Promise<void>;
  /** 销毁 */
  destroy(): void;
}
