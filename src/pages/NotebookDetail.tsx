import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';
import { annotationStore } from '@/stores/annotation';
import { libraryStore } from '@/stores/library';
import { ANNOTATION_COLORS_HEX } from '@/types';

export default function NotebookDetail() {
  const params = useParams();
  const navigate = useNavigate();

  const notebook = createMemo(() => notebookStore.getById(params.id));
  const [filterBook, setFilterBook] = createSignal<string | 'all'>('all');

  const allAnnotations = createMemo(() => {
    const nb = notebook();
    if (!nb) return [];
    return notebookStore
      .getAnnotationIds(nb.id)
      .map((aid) => annotationStore.getById(aid))
      .filter((a): a is NonNullable<typeof a> => !!a);
  });

  const filteredAnnotations = createMemo(() => {
    const fb = filterBook();
    return fb === 'all'
      ? allAnnotations()
      : allAnnotations().filter((a) => a.bookId === fb);
  });

  const involvedBooks = createMemo(() => {
    const bookIds = new Set(allAnnotations().map((a) => a.bookId));
    return Array.from(bookIds)
      .map((id) => libraryStore.getById(id))
      .filter((b): b is NonNullable<typeof b> => !!b);
  });

  return (
    <div class="page page-notebook-detail">
      <Show when={notebook()} fallback={<div class="empty">笔记本不存在</div>}>
        {(nb) => (
          <>
            <header class="page-header">
              <button class="btn btn-ghost" onClick={() => navigate('/notebooks')}>‹ 返回</button>
              <h1>{nb().name}</h1>
              <button class="btn btn-ghost" onClick={() => navigate(`/notebook/${nb().id}/edit`)}>编辑</button>
            </header>

            <Show when={nb().description}>
              {(d) => <p class="text-secondary text-sm" style={{ 'margin-bottom': 'var(--space-3)' }}>{d()}</p>}
            </Show>

            <div class="stats-row">
              <span class="text-secondary text-sm">共 {allAnnotations().length} 条标注</span>
              <span class="text-tertiary text-sm">来自 {involvedBooks().length} 本书</span>
            </div>

            <Show when={involvedBooks().length > 1}>
              <div class="filter-bar">
                <button
                  class="filter-chip"
                  classList={{ 'filter-chip--active': filterBook() === 'all' }}
                  onClick={() => setFilterBook('all')}
                >
                  全部
                </button>
                <For each={involvedBooks()}>
                  {(b) => (
                    <button
                      class="filter-chip"
                      classList={{ 'filter-chip--active': filterBook() === b.id }}
                      onClick={() => setFilterBook(b.id)}
                    >
                      {b.title}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show
              when={filteredAnnotations().length > 0}
              fallback={
                <div class="empty">
                  <p>笔记本是空的</p>
                  <p class="text-secondary text-sm">在阅读时把笔记添加到这个笔记本</p>
                </div>
              }
            >
              <ul class="annotation-list">
                <For each={filteredAnnotations()}>
                  {(ann) => {
                    const book = libraryStore.getById(ann.bookId);
                    return (
                      <li
                        class="annotation-item"
                        onClick={() => navigate(`/book/${ann.bookId}?anno=${ann.id}`)}
                      >
                        <div
                          class="annotation-item__color"
                          style={{ background: ANNOTATION_COLORS_HEX[ann.color] }}
                        />
                        <div class="annotation-item__body">
                          <Show when={ann.selectedText}>
                            {(t) => <blockquote class="annotation-item__quote">「{t()}」</blockquote>}
                          </Show>
                          <Show when={ann.noteText}>
                            {(note) => <p class="annotation-item__note">{note()}</p>}
                          </Show>
                          <p class="text-tertiary text-xs">
                            {book?.title ?? '未知书目'} ·{' '}
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
