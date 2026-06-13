// 阅读器挂载入口 - M1 完整实现
// 根据书的格式 dispatch 到对应渲染器
import { readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Book } from '@/types';
import type { ReaderController } from './types';
import { createFoliateReader } from './foliate';
import { createPdfReader } from './pdf';
import { createTxtReader } from './txt';

export interface MountOptions {
  container: HTMLElement;
  book: Book;
  focusAnnotationId?: string;
}

export type MountCleanup = ReaderController;

/**
 * 读取书文件 → 选渲染器 → 挂载
 */
export async function mountReader(opts: MountOptions): Promise<MountCleanup> {
  const { container, book } = opts;

  // 1. 读取书字节
  const data = await readFile(book.filePath);
  // pdfjs 在 TS 5.7 下需要 ArrayBuffer(不是 Uint8Array<ArrayBuffer>)
  // 把 Uint8Array 包一层成 ArrayBuffer
  const buf: ArrayBuffer =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : (data as ArrayBuffer);

  // 2. 按格式选渲染器
  switch (book.format) {
    case 'epub':
    case 'mobi':
    case 'fb2':
    case 'cbz':
      return await createFoliateReader(container, buf, book.format);

    case 'pdf':
      return await createPdfReader(container, buf);

    case 'txt':
      return await createTxtReader(container, buf, book.title, createFoliateReader);

    default:
      throw new Error(`不支持的格式: ${book.format}`);
  }
}
