import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { importBook } from '@/services/importer';

export default function Library() {
  const navigate = useNavigate();

  async function handleImport() {
    try {
      const book = await importBook();
      if (book) navigate(`/book/${book.id}`);
    } catch (err) {
      console.error('[Library] import failed', err);
      alert('导入失败: ' + (err as Error).message);
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
                  <Show when={book.cover} fallback={<div class="book-card__cover-placeholder" />}>
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
