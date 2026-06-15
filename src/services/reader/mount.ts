// 阅读器挂载入口 - M1 完整实现
// 根据书的格式 dispatch 到对应渲染器
import { readFile, exists } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join, basename } from '@tauri-apps/api/path';
import type { Book } from '@/types';
import type { ReaderController } from './types';
import { createFoliateReader } from './foliate';
import { createPdfReader } from './pdf';
import { createTxtReader } from './txt';
import { wlog } from '../webview-log';
import { libraryStore } from '@/stores/library';

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
  await wlog('info', `mountReader: start format=${book.format} filePath=${book.filePath}`);

  // 文件路径可能因 app data container UUID 变化而失效 (iOS 重装后 UUID 会变)
  // 也可能 Tauri scope 把它 deny 掉。两种情况都 fallback 到 appDataDir/books/ + basename
  let realPath = book.filePath;
  let needFallback = false;
  try {
    const present = await exists(realPath);
    if (!present) needFallback = true;
  } catch (err) {
    // exists() 抛 forbidden path 错误 → scope 拒绝访问这个旧 path
    await wlog('warn', `mountReader: exists() threw for ${realPath}, will try fallback`, err);
    needFallback = true;
  }
  if (needFallback) {
    try {
      const dataDir = await appDataDir();
      const fallback = await join(dataDir, 'books', await basename(book.filePath));
      await wlog('warn', `mountReader: trying fallback ${fallback}`);
      const present2 = await exists(fallback);
      if (!present2) {
        await wlog('error', `mountReader: fallback also missing ${fallback}`);
        throw new Error(`书文件不存在: ${book.filePath} (also tried ${fallback})`);
      }
      realPath = fallback;
      // 顺便更新 libraryStore 里这个 book 的 filePath,下次就不用 fallback 了
      libraryStore.updateFilePath(book.id, fallback);
      await wlog('info', `mountReader: resolved to ${realPath}, updated library`);
    } catch (err) {
      await wlog('error', 'mountReader: fallback lookup failed', err);
      throw err;
    }
  }

  // 1. 读取书字节
  const data = await readFile(realPath);
  await wlog('info', `mountReader: readFile OK, bytes=${(data as Uint8Array).length}`);
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
      await wlog('info', `mountReader: dispatching to foliate (format=${book.format})`);
      return await createFoliateReader(container, buf, book.format);

    case 'pdf':
      return await createPdfReader(container, buf);

    case 'txt':
      return await createTxtReader(container, buf, book.title, createFoliateReader);

    default:
      throw new Error(`不支持的格式: ${book.format}`);
  }
}
