// 导入书的服务 - M1 完整实现
// 流程:
//   1. Tauri dialog.open 选文件
//   2. 复制到 app 沙箱
//   3. 提取 metadata(书名/作者/cover)
//   4. 返回 Book
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, documentDir, join, basename } from '@tauri-apps/api/path';
import { libraryStore } from '@/stores/library';
import { wlog } from './webview-log';
import type { Book, BookFormat } from '@/types';

export interface ImportResult extends Book {}

const ALLOWED_EXTENSIONS = ['epub', 'mobi', 'azw', 'azw3', 'kf8', 'pdf', 'fb2', 'cbz', 'zip', 'txt'];

/**
 * 检测文件格式
 */
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

/**
 * 复制选中的文件到 app 沙箱 books/ 目录
 * 返回新文件路径
 */
async function copyToSandbox(sourcePath: string, fileName: string): Promise<string> {
  console.log('[importer] copyToSandbox: appDataDir()');
  const dataDir = await appDataDir();
  console.log('[importer] copyToSandbox: dataDir =', dataDir);
  const booksDir = await join(dataDir, 'books');
  console.log('[importer] copyToSandbox: booksDir =', booksDir);
  if (!(await exists(booksDir))) {
    console.log('[importer] copyToSandbox: mkdir booksDir');
    await mkdir(booksDir, { recursive: true });
  }
  const dest = await join(booksDir, fileName);
  console.log('[importer] copyToSandbox: dest =', dest);
  console.log('[importer] copyToSandbox: readFile(sourcePath) START');
  const data = await readFile(sourcePath);
  console.log('[importer] copyToSandbox: readFile OK, bytes =', (data as Uint8Array).length ?? '?');
  console.log('[importer] copyToSandbox: writeFile(dest) START');
  await writeFile(dest, data);
  console.log('[importer] copyToSandbox: writeFile OK');
  return dest;
}

/**
 * 提取 EPUB / MOBI 等的元数据
 * 简化版:从文件内容中查找 OPF 里的 title/author,失败时用文件名
 */
async function extractMetadata(filePath: string, format: BookFormat, fileName: string): Promise<{
  title: string;
  author: string;
  cover?: string;
}> {
  // 默认用文件名去掉后缀作为标题
  const fallback = () => ({
    title: fileName.replace(/\.[^.]+$/, ''),
    author: '未知',
  });

  if (format === 'pdf' || format === 'txt' || format === 'cbz') {
    return fallback();
  }

  try {
    const data = await readFile(filePath);
    // 简化:不深解析,只从 container.xml 找 OPF
    // 实际实现见 M1 后续优化
    if (format === 'epub' || format === 'mobi' || format === 'fb2') {
      return extractFromEbook(data).then((r) => r ?? fallback());
    }
    return fallback();
  } catch {
    return fallback();
  }
}

/**
 * 从 EPUB/zip 字节流提取 title/author
 * 简化:仅在中央目录里搜 .opf 文件名,然后解这一项
 */
async function extractFromEbook(data: Uint8Array): Promise<{
  title: string;
  author: string;
  cover?: string;
} | null> {
  try {
    // 用 zip.js v2.8 解析
    const { ZipReader, BlobReader, TextWriter, Uint8ArrayWriter } = await import('@zip.js/zip.js');
    const blob = new Blob([data as BlobPart]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    // 找 container.xml → rootfile 路径
    const container = entries.find((e) => e.filename === 'META-INF/container.xml');
    if (!container || container.directory) {
      await reader.close();
      return null;
    }
    // getData 在 v2.8 中传入 Writer,返回 writer 收集到的内容
    const containerText = await (container as any).getData(new TextWriter()) as string;
    const rootfileMatch = containerText.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) {
      await reader.close();
      return null;
    }
    const opfPath = rootfileMatch[1];
    const opf = entries.find((e) => e.filename === opfPath);
    if (!opf || opf.directory) {
      await reader.close();
      return null;
    }
    const opfText = await (opf as any).getData(new TextWriter()) as string;

    // 用 DOMParser 解析 OPF,避免正则对属性顺序的依赖
    // (EPUB 里 <item> 的属性顺序不固定:有的 href 在前 properties 在后,反过来也有)
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfText, 'application/xml');
    const parseError = opfDoc.querySelector('parsererror');
    if (parseError) {
      await reader.close();
      return null;
    }

    const titleEl = opfDoc.getElementsByTagName('dc:title')[0] ?? opfDoc.getElementsByTagName('title')[0];
    const title = titleEl?.textContent?.trim() ?? '';

    // 作者:取第一个 dc:creator
    const creatorEls = opfDoc.getElementsByTagName('dc:creator');
    const author = creatorEls[0]?.textContent?.trim() ?? '';

    // 提取封面 (3 选 1 + 兜底):
    // 1) manifest item 带 properties="cover-image"
    // 2) <meta name="cover" content="<id>"/> → manifest 里 id 相同的 item
    // 3) <guide> 里的 <reference type="cover" href="..."/>
    // 4) 兜底:找 OPF 同目录下 cover.* 文件
    const manifestItems = Array.from(opfDoc.getElementsByTagName('item'));
    let coverHref: string | undefined;

    // 路径 1: properties="cover-image"
    for (const item of manifestItems) {
      const props = item.getAttribute('properties') ?? '';
      if (props.split(/\s+/).includes('cover-image')) {
        coverHref = item.getAttribute('href') ?? undefined;
        if (coverHref) break;
      }
    }

    // 路径 2: <meta name="cover" content="<id>"/>
    if (!coverHref) {
      const metaEls = Array.from(opfDoc.getElementsByTagName('meta'));
      const coverMeta = metaEls.find(
        (m) => (m.getAttribute('name') ?? '').toLowerCase() === 'cover',
      );
      if (coverMeta) {
        const coverId = coverMeta.getAttribute('content') ?? '';
        for (const item of manifestItems) {
          if (item.getAttribute('id') === coverId) {
            coverHref = item.getAttribute('href') ?? undefined;
            break;
          }
        }
      }
    }

    // 路径 3: <guide><reference type="cover" href="..."/></guide>
    if (!coverHref) {
      const refEls = Array.from(opfDoc.getElementsByTagName('reference'));
      const coverRef = refEls.find(
        (r) => (r.getAttribute('type') ?? '').toLowerCase() === 'cover',
      );
      if (coverRef) {
        coverHref = coverRef.getAttribute('href') ?? undefined;
      }
    }

    let cover: string | undefined;
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

    if (coverHref) {
      const resolvedHref = coverHref.startsWith('../')
        ? resolveRelative(opfDir, coverHref)
        : (opfDir + coverHref).replace(/\/+/g, '/');
      const cleanHref = resolvedHref.split('#')[0];
      const imgEntry = entries.find((e) => e.filename === cleanHref);
      if (imgEntry && !imgEntry.directory) {
        const writer = new Uint8ArrayWriter();
        const bytes = await (imgEntry as any).getData(writer);
        const mime = mimeFromFilename(cleanHref);
        const base64 = bytesToBase64(bytes as Uint8Array);
        cover = `data:${mime};base64,${base64}`;
      }
    }

    if (!cover) {
      // 兜底:在 OPF 同目录找 cover.*
      const coverEntry = entries.find(
        (e) => !e.directory && /^cover\.(jpe?g|png|webp|gif)$/i.test(e.filename) && e.filename.startsWith(opfDir),
      );
      if (coverEntry) {
        const writer = new Uint8ArrayWriter();
        const bytes = await (coverEntry as any).getData(writer);
        const mime = mimeFromFilename(coverEntry.filename);
        const base64 = bytesToBase64(bytes as Uint8Array);
        cover = `data:${mime};base64,${base64}`;
      }
    }

    await reader.close();

    return {
      title,
      author,
      cover,
    };
  } catch {
    return null;
  }
}

function mimeFromFilename(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function resolveRelative(baseDir: string, href: string): string {
  // 简单实现:处理 "../" 开头的相对路径
  const parts = (baseDir + href).split('/');
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') {
      stack.pop();
    } else {
      stack.push(p);
    }
  }
  return stack.join('/');
}

function bytesToBase64(bytes: Uint8Array): string {
  // 体积大时分块处理,避免一次性 toBase64 触发 RangeError
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

/**
 * 主入口:选文件 → 复制 → 提取 metadata → 入库
 */
export async function importBook(): Promise<ImportResult | null> {
  const selected = await openDialog({
    multiple: false,
    directory: false,
    title: '选择电子书',
    filters: [
      {
        name: '电子书',
        extensions: ALLOWED_EXTENSIONS,
      },
    ],
  });

  if (!selected || typeof selected !== 'string') return null;
  console.log('[importer] selected path =', selected, 'typeof =', typeof selected);

  const format = detectFormat(selected);
  console.log('[importer] detected format =', format);
  if (!format) {
    throw new Error('不支持的文件格式');
  }

  const fileName = await basename(selected);
  console.log('[importer] basename =', fileName);

  // 复制到沙箱
  console.log('[importer] copyToSandbox start');
  const destPath = await copyToSandbox(selected, fileName);
  console.log('[importer] copyToSandbox done, dest =', destPath);

  // 提取 metadata
  console.log('[importer] extractMetadata start');
  const { title, author, cover } = await extractMetadata(destPath, format, fileName);
  console.log('[importer] extractMetadata done, title =', title, 'author =', author);

  // 入库
  console.log('[importer] libraryStore.addBook start');
  const book = libraryStore.addBook({
    format,
    filePath: destPath,
    title,
    author,
    cover,
  });
  console.log('[importer] addBook done, id =', book?.id);

  return book;
}

/**
 * iOS / 真机调试专用:扫描 app 沙箱的 Documents/ 目录,自动导入里面的电子书
 * (用户从 Files.app 拖入或 devicectl 推送的文件都在这里)
 * 不用 readDir 避免需要 fs:allow-read-dir 权限,改用 hardcode 列表 + exists 探测
 */
const KNOWN_DOCS_FILES = [
  '三言二拍插图典藏版.epub',
  'sample.epub',
];

export async function importFromDocumentsDir(): Promise<ImportResult | null> {
  let docsDir: string;
  try {
    docsDir = await documentDir();
  } catch (err) {
    await wlog('error', 'auto-import: documentDir() failed', err);
    return null;
  }
  await wlog('info', `auto-import: documentDir = ${docsDir}`);

  for (const filename of KNOWN_DOCS_FILES) {
    const sourcePath = await join(docsDir, filename);
    // 探测存在性:exists() 在 iOS 真机上对 devicectl 推入的文件可能不可靠
    // 改用 readFile 试读,失败就跳过(读权限和存在性都覆盖了)
    let probeOk = false;
    let probeBytes = 0;
    try {
      const probe = await readFile(sourcePath);
      probeBytes = (probe as Uint8Array).length ?? 0;
      probeOk = probeBytes > 0;
    } catch (err) {
      await wlog('info', `auto-import: readFile probe failed for ${sourcePath}`, err);
    }
    if (!probeOk) {
      await wlog('info', `auto-import: not present ${sourcePath}`);
      continue;
    }
    await wlog('info', `auto-import: probe OK ${sourcePath} (${probeBytes} bytes)`);

    // 如果已经在 library 里(按 filePath 或 filename),跳过
    const already = libraryStore.books.find(
      (b) => b.filePath === sourcePath || b.filePath.endsWith('/' + filename),
    );
    if (already) {
      await wlog('info', `auto-import: already in library, id=${already.id}`);
      return already;
    }

    await wlog('info', `auto-import: found ${sourcePath}`);
    try {
      const format = detectFormat(filename);
      if (!format) {
        await wlog('warn', `auto-import: unsupported format ${filename}`);
        continue;
      }
      const destPath = await copyToSandbox(sourcePath, filename);
      const { title, author, cover } = await extractMetadata(destPath, format, filename);
      const book = libraryStore.addBook({
        format,
        filePath: destPath,
        title,
        author,
        cover,
      });
      await wlog('info', `auto-import: success id=${book.id} title="${book.title}"`);
      return book;
    } catch (err) {
      await wlog('error', `auto-import: failed for ${filename}`, err);
      return null;
    }
  }
  return null;
}
