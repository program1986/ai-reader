// 导入书的服务
// M0 阶段:占位接口;M1 阶段:实现真正的文件选择+元数据提取
import type { Book, BookFormat } from '@/types';

export interface ImportResult extends Book {}

/**
 * 弹文件选择器,导入一本书
 * 流程:
 * 1. Tauri 端 dialog.open 选文件
 * 2. 复制到 app 沙箱
 * 3. 解 metadata(书名/作者/cover)
 * 4. 返回 Book
 */
export async function importBook(): Promise<ImportResult | null> {
  // M1 实现
  throw new Error('M0 stub: importBook 将在 M1 实现');
}

export function detectFormat(filename: string): BookFormat | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'epub':
      return 'epub';
    case 'mobi':
    case 'azw':
    case 'azw3':
    case 'kf8':
      return 'mobi';
    case 'pdf':
      return 'pdf';
    case 'fb2':
    case 'fb2.zip':
      return 'fb2';
    case 'cbz':
    case 'zip':
      return 'cbz';
    case 'txt':
      return 'txt';
    default:
      return null;
  }
}
