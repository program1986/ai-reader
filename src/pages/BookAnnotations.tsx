import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { annotationStore } from '@/stores/annotation';
import { notebookStore } from '@/stores/notebook';
import { ANNOTATION_COLORS_HEX } from '@/types';
import type { AnnotationType } from '@/types';

const FILTERS: { value: AnnotationType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'highlight', label: '划线' },
  { value: 'note', label: '笔记' },
  { value: 'highlight_note', label: '划线+笔记' },
];

export default function BookAnnotations() {
  const params = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal<AnnotationType | 'all'>('all');

  const book = createMemo(() => libraryStore.getById(params.id));
  const annotations = createMemo(() => {
    const b = book();
    if (!b) return [];
    const all = annotationStore.getByBook(b.id);
    const f = filter();
    return f === 'all' ? all : all.filter((a) => a.type === f);
  });

  function jumpToAnnotation(annoId: string) {
    navigate(`/book/${params.id}?anno=${annoId}`);
  }

  function handleAddNotebook(annoId: string, notebookId: string) {
    notebookStore.addAnnotation(notebookId, annoId);
  }

  return (
    <div class="page page-book-annotations">
      <Show when={book()} fallback={<div class="empty">书不存在</div>}>
        {(b) => (
          <>
            <header class="page-header">
              <button class="btn btn-ghost" onClick={() => navigate(`/book/${b().id}`)}>‹ 返回</button>
              <h1>{b().title} · 笔记</h1>
            </header>

            <div class="filter-bar">
              <For each={FILTERS}>
                {(f) => (
                  <button
                    class="filter-chip"
                    classList={{ 'filter-chip--active': filter() === f.value }}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </button>
                )}
              </For>
            </div>

            <Show
              when={annotations().length > 0}
              fallback={<div class="empty">还没有标注</div>}
            >
              <ul class="annotation-list">
                <For each={annotations()}>
                  {(ann) => (
                    <li class="annotation-item" onClick={() => jumpToAnnotation(ann.id)}>
                      <div
                        class="annotation-item__color"
                        style={{ background: ANNOTATION_COLORS_HEX[ann.color] }}
                      />
                      <div class="annotation-item__body">
                        <Show when={ann.selectedText}>
                          {(t) => <blockquote class="annotation-item__quote">「{t()}」</blockquote>}
                        </Show>
                        <Show when={ann.noteText}>
                          {(n) => <p class="annotation-item__note">{n()}</p>}
                        </Show>
                        <div class="row" style={{ 'margin-top': '4px' }}>
                          <select
                            class="input input--sm"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.currentTarget.value) {
                                handleAddNotebook(ann.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          >
                            <option value="">加入笔记本…</option>
                            <For each={notebookStore.notebooks}>
                              {(nb) => <option value={nb.id}>{nb.name}</option>}
                            </For>
                          </select>
                        </div>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
