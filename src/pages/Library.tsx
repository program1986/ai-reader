import { For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { importBook, importFromDocumentsDir } from '@/services/importer';
import { wlog } from '@/services/webview-log';

export default function Library() {
  const navigate = useNavigate();

  wlog('info', 'Library: component loaded').catch(() => {});

  onMount(async () => {
    await wlog('info', 'Library: onMount fired');
    // 注意:不要在 onMount 里 auto-navigate 到 /book/:id
    // 否则从 reader 点返回时,Library 重新挂载又会跳回 reader,看起来像"返回没反应"
    // 真机调试只做自动导入,导入完成后让用户手动点击书进入
    if (libraryStore.books.length === 0) {
      try {
        await wlog('info', 'Library: onMount: starting auto-import');
        const book = await importFromDocumentsDir();
        await wlog('info', `Library: onMount: importFromDocumentsDir returned ${book ? book.id : 'null'}`);
      } catch (err) {
        await wlog('error', 'Library: onMount: auto-import failed', err);
      }
    } else {
      await wlog('info', `Library: onMount: ${libraryStore.books.length} books in library, no auto-navigate`);
    }
  });

  async function handleImport() {
    try {
      console.log('[Library] importBook() start');
      const book = await importBook();
      console.log('[Library] importBook() returned', book);
      if (book) navigate(`/book/${book.id}`);
    } catch (err) {
      console.error('[Library] import failed', err);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}));
      alert('导入失败: ' + (msg || '(no message)'));
    }
  }

  return (
    <div class="page page-library">
      <header class="page-header">
        <h1>书架</h1>
        <button class="btn btn-primary" onClick={handleImport}>
          ＋ 导入
        </button>
      </header>

      <Show
        when={libraryStore.books.length > 0}
        fallback={
          <div class="empty">
            <p>书架是空的</p>
            <p class="text-secondary text-sm">点击右上角"导入"添加第一本书</p>
            <p class="text-tertiary text-xs" style={{ 'margin-top': '24px' }}>
              支持 EPUB / MOBI / PDF / FB2 / CBZ / TXT
            </p>
          </div>
        }
      >
        <ul class="book-grid">
          <For each={libraryStore.books}>
            {(book) => (
              <li
                class="book-card"
                onClick={() => navigate(`/book/${book.id}`)}
              >
                <div class="book-card__cover">
                  <Show
                    when={book.cover}
                    fallback={
                      <div class="book-card__cover-fallback">
                        <span class="book-card__cover-fallback-char">
                          {(book.title || '?').charAt(0)}
                        </span>
                      </div>
                    }
                  >
                    <img src={book.cover} alt={book.title} />
                  </Show>
                </div>
                <div class="book-card__meta">
                  <h3 class="book-card__title">{book.title}</h3>
                  <p class="book-card__author text-secondary text-sm">{book.author}</p>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
