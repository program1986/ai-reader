// 阅读器挂载服务 - 把 foliate-js / pdfjs 实例化到指定 DOM
// M0 stub,M1 实现
import type { Book } from '@/types';

export interface MountOptions {
  container: HTMLElement;
  book: Book;
  focusAnnotationId?: string;
}

export interface MountCleanup {
  (): void;
}

/**
 * 根据书的格式选择渲染器并挂载
 * 返回清理函数
 */
export async function mountReader(_opts: MountOptions): Promise<MountCleanup> {
  // M1 实现
  throw new Error('M0 stub: mountReader 将在 M1 实现');
}
