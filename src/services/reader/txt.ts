// TXT 转 EPUB,然后用 foliate-js 渲染
// 在 web worker 里做转换,主线程拿到 ArrayBuffer 后调 foliate-js
import type { ReaderController } from './types';

// EPUB 规范要求 mimetype 必须是第一个 entry,且不压缩
const COMPRESSION_STORE = 0;

/**
 * 把纯文本包装成最简 EPUB(单章节、单页)
 * 简化:不严格遵循 EPUB 规范,只保证 foliate-js 能解析
 */
export async function txtToEpubBytes(txt: string, title: string): Promise<ArrayBuffer> {
  // 分章节(简单按 \n\n 切)
  const paragraphs = txt.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chapterHtml = paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  // 构造 EPUB zip(zip.js v2.8 API:TextReader(filename, value) + add)
  const { ZipWriter, BlobWriter, TextReader } = await import('@zip.js/zip.js');
  const zip = new ZipWriter(new BlobWriter('application/epub+zip'));

  await zip.add('mimetype', new TextReader('application/epub+zip'), {
    compressionMethod: COMPRESSION_STORE,
  });
  await zip.add('META-INF/container.xml', new TextReader(
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  ));
  await zip.add('OEBPS/content.opf', new TextReader(
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`,
  ));
  await zip.add('OEBPS/nav.xhtml', new TextReader(
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>${escapeXml(title)}</title></head>
  <body>
    <nav epub:type="toc"><ol><li><a href="ch1.xhtml">开始</a></li></ol></nav>
  </body>
</html>`,
  ));
  await zip.add('OEBPS/ch1.xhtml', new TextReader(
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${escapeXml(title)}</title>
    <style>body{font-family:serif;line-height:1.6;padding:1em;}</style>
  </head>
  <body><h1>${escapeXml(title)}</h1>${chapterHtml}</body>
</html>`,
  ));
  const blob = await zip.close();
  return await blob.arrayBuffer();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * TXT 阅读入口:
 * 1. fetch file (Tauri 端)
 * 2. 转成 EPUB bytes
 * 3. 用 foliate-js 渲染
 *
 * 实际调用方在 mount.ts 里 dispatch
 */
export async function createTxtReader(
  container: HTMLElement,
  bookData: ArrayBuffer | Uint8Array,
  title: string,
  foliateFactory: (container: HTMLElement, data: ArrayBuffer | Uint8Array, format: 'epub') => Promise<ReaderController>,
): Promise<ReaderController> {
  const txt = new TextDecoder('utf-8', { fatal: false }).decode(bookData);
  const epubBytes = await txtToEpubBytes(txt, title);
  return foliateFactory(container, epubBytes, 'epub');
}
