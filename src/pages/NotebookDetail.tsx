import { For, Show, createMemo } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';
import { annotationStore } from '@/stores/annotation';
import { libraryStore } from '@/stores/library';
import { ANNOTATION_COLORS_HEX } from '@/types';

export default function NotebookDetail() {
  const params = useParams();
  const navigate = useNavigate();

  const notebook = createMemo(() => notebookStore.getById(params.id));
  const annotations = createMemo(() => {
    const nb = notebook();
    if (!nb) return [];
    return notebookStore
      .getAnnotationIds(nb.id)
      .map((aid) => annotationStore.getById(aid))
      .filter((a): a is NonNullable<typeof a> => !!a);
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

            <Show
              when={annotations().length > 0}
              fallback={
                <div class="empty">
                  <p>笔记本是空的</p>
                  <p class="text-secondary text-sm">在阅读时把笔记添加到这个笔记本</p>
                </div>
              }
            >
              <ul class="annotation-list">
                <For each={annotations()}>
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
                            {(text) => <blockquote class="annotation-item__quote">「{text()}」</blockquote>}
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
