import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';
import { annotationStore } from '@/stores/annotation';
import { libraryStore } from '@/stores/library';
import { ANNOTATION_COLORS_HEX } from '@/types';

export default function NotebookEdit() {
  const params = useParams();
  const navigate = useNavigate();

  const notebook = createMemo(() => notebookStore.getById(params.id ?? ''));
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [initialized, setInitialized] = createSignal(false);
  const [mergeInto, setMergeInto] = createSignal<string | null>(null);
  const [filterBook, setFilterBook] = createSignal<string | 'all'>('all');
  const [search, setSearch] = createSignal('');

  if (notebook() && !initialized()) {
    setName(notebook()!.name);
    setDescription(notebook()!.description ?? '');
    setInitialized(true);
  }

  const visibleAnnotations = createMemo(() => {
    let list = annotationStore.annotations;
    const fb = filterBook();
    if (fb !== 'all') list = list.filter((a) => a.bookId === fb);
    const q = search().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (a) =>
          (a.selectedText ?? '').toLowerCase().includes(q) ||
          (a.noteText ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  });

  function handleRename() {
    const nb = notebook();
    if (!nb) return;
    const v = name().trim();
    if (v && v !== nb.name) notebookStore.rename(nb.id, v);
    const d = description().trim();
    notebookStore.updateDescription(nb.id, d);
  }

  function handleDelete() {
    const nb = notebook();
    if (!nb) return;
    if (!confirm(`确定删除笔记本「${nb.name}」?笔记本身会保留。`)) return;
    notebookStore.remove(nb.id);
    navigate('/notebooks');
  }

  function handleMerge() {
    const nb = notebook();
    const target = mergeInto();
    if (!nb || !target) return;
    if (!confirm(`合并后,「${nb.name}」的所有标注会转入目标笔记本,「${nb.name}」会被删除。继续?`)) return;
    notebookStore.merge(nb.id, target);
    navigate('/notebooks');
  }

  function isLinked(annoId: string) {
    const nb = notebook();
    if (!nb) return false;
    return notebookStore.getAnnotationIds(nb.id).includes(annoId);
  }

  function toggleLink(annoId: string) {
    const nb = notebook();
    if (!nb) return;
    if (isLinked(annoId)) {
      notebookStore.removeAnnotation(nb.id, annoId);
    } else {
      notebookStore.addAnnotation(nb.id, annoId);
    }
  }

  function addAll() {
    const nb = notebook();
    if (!nb) return;
    if (!confirm(`将本视图所有未加入的标注全部加入「${nb.name}」?`)) return;
    for (const a of visibleAnnotations()) {
      if (!isLinked(a.id)) {
        notebookStore.addAnnotation(nb.id, a.id);
      }
    }
  }

  function removeAll() {
    const nb = notebook();
    if (!nb) return;
    if (!confirm(`从「${nb.name}」移除本视图所有已包含的标注?笔记本体保留。`)) return;
    for (const a of visibleAnnotations()) {
      if (isLinked(a.id)) {
        notebookStore.removeAnnotation(nb.id, a.id);
      }
    }
  }

  return (
    <div class="page page-notebook-edit">
      <Show when={notebook()} fallback={<div class="empty">笔记本不存在</div>}>
        {(nb) => (
          <>
            <header class="page-header">
              <button class="btn btn-ghost" onClick={() => navigate(`/notebook/${nb().id}`)}>‹ 返回</button>
              <h1>编辑笔记本</h1>
            </header>

            <section class="form-section">
              <label class="form-label">名称</label>
              <input
                class="input"
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                onBlur={handleRename}
              />
              <label class="form-label">描述</label>
              <textarea
                class="input"
                rows="2"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                onBlur={handleRename}
                placeholder="可选"
              />
            </section>

            <section class="form-section">
              <h2>包含的标注</h2>
              <p class="text-secondary text-sm">
                已加入 {notebookStore.getAnnotationIds(nb().id).length} / {annotationStore.annotations.length} 条
              </p>
              <div class="filter-bar">
                <input
                  class="input"
                  type="text"
                  placeholder="搜索标注…"
                  value={search()}
                  onInput={(e) => setSearch(e.currentTarget.value)}
                />
                <select
                  class="input"
                  value={filterBook()}
                  onChange={(e) => setFilterBook(e.currentTarget.value)}
                  style={{ 'flex-shrink': '0' }}
                >
                  <option value="all">全部书</option>
                  <For each={libraryStore.books}>
                    {(b) => <option value={b.id}>{b.title}</option>}
                  </For>
                </select>
              </div>
              <div class="row">
                <button class="btn btn-sm" onClick={addAll}>批量加入</button>
                <button class="btn btn-sm" onClick={removeAll}>批量移除</button>
              </div>
              <ul class="annotation-pick-list">
                <For each={visibleAnnotations()}>
                  {(ann) => {
                    const book = libraryStore.getById(ann.bookId);
                    return (
                      <li class="annotation-pick-item">
                        <input
                          type="checkbox"
                          checked={isLinked(ann.id)}
                          onChange={() => toggleLink(ann.id)}
                        />
                        <div
                          class="annotation-item__color"
                          style={{ background: ANNOTATION_COLORS_HEX[ann.color] }}
                        />
                        <div class="annotation-pick-item__body">
                          <Show when={ann.selectedText}>
                            {(t) => <p class="text-sm">「{t().slice(0, 80)}{t().length > 80 ? '…' : ''}」</p>}
                          </Show>
                          <Show when={ann.noteText && !ann.selectedText ? ann.noteText : undefined}>
                            {(n) => <p class="text-sm">{n().slice(0, 80)}{n().length > 80 ? '…' : ''}</p>}
                          </Show>
                          <p class="text-tertiary text-xs">{book?.title ?? '未知'}</p>
                        </div>
                      </li>
                    );
                  }}
                </For>
              </ul>
            </section>

            <section class="form-section">
              <h2>合并到其他笔记本</h2>
              <div class="row">
                <select
                  class="input"
                  value={mergeInto() ?? ''}
                  onChange={(e) => setMergeInto(e.currentTarget.value || null)}
                >
                  <option value="">选择目标笔记本…</option>
                  <For each={notebookStore.notebooks.filter((n) => n.id !== nb().id)}>
                    {(other) => <option value={other.id}>{other.name}</option>}
                  </For>
                </select>
                <button class="btn" disabled={!mergeInto()} onClick={handleMerge}>合并</button>
              </div>
              <p class="text-tertiary text-xs">合并后,本笔记本的标注全部转入目标笔记本,本笔记本删除。</p>
            </section>

            <section class="form-section">
              <h2 class="text-danger">危险操作</h2>
              <button class="btn btn-danger" onClick={handleDelete}>删除笔记本</button>
              <p class="text-tertiary text-xs">删除笔记本不会删除其中的标注。</p>
            </section>
          </>
        )}
      </Show>
    </div>
  );
}
