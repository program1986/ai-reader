import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';
import { annotationStore } from '@/stores/annotation';
import { libraryStore } from '@/stores/library';
import { ANNOTATION_COLORS_HEX } from '@/types';

export default function NotebookEdit() {
  const params = useParams();
  const navigate = useNavigate();

  const notebook = createMemo(() => notebookStore.getById(params.id));
  const allAnnotations = createMemo(() => annotationStore.annotations);
  const [name, setName] = createSignal('');
  const [initialized, setInitialized] = createSignal(false);
  const [mergeInto, setMergeInto] = createSignal<string | null>(null);

  // 初始化 name (只一次)
  if (notebook() && !initialized()) {
    setName(notebook()!.name);
    setInitialized(true);
  }

  function handleRename() {
    const nb = notebook();
    if (!nb) return;
    const v = name().trim();
    if (!v || v === nb.name) return;
    notebookStore.rename(nb.id, v);
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
              <div class="row">
                <input
                  class="input"
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  onBlur={handleRename}
                />
              </div>
            </section>

            <section class="form-section">
              <h2>包含的标注</h2>
              <p class="text-secondary text-sm">勾选要加入笔记本的标注。已加入 {notebookStore.getAnnotationIds(nb().id).length} 条</p>
              <ul class="annotation-pick-list">
                <For each={allAnnotations()}>
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
                <button
                  class="btn"
                  disabled={!mergeInto()}
                  onClick={handleMerge}
                >
                  合并
                </button>
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
