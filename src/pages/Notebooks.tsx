import { For, Show, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';

export default function Notebooks() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);
  const [newName, setNewName] = createSignal('');

  function handleCreate(e: Event) {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    const nb = notebookStore.create(name);
    setNewName('');
    setCreating(false);
    navigate(`/notebook/${nb.id}`);
  }

  function annotationCount(notebookId: string) {
    return notebookStore.getAnnotationIds(notebookId).length;
  }

  return (
    <div class="page page-notebooks">
      <header class="page-header">
        <h1>笔记本</h1>
        <button class="btn btn-primary" onClick={() => setCreating(true)}>
          ＋ 新建
        </button>
      </header>

      <Show when={creating()}>
        <form class="inline-form" onSubmit={handleCreate}>
          <input
            class="input"
            type="text"
            placeholder="笔记本名称"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            autofocus
          />
          <button class="btn btn-primary" type="submit">创建</button>
          <button class="btn" type="button" onClick={() => setCreating(false)}>取消</button>
        </form>
      </Show>

      <Show
        when={notebookStore.notebooks.length > 0}
        fallback={
          <div class="empty">
            <p>还没有笔记本</p>
            <p class="text-secondary text-sm">建一个笔记本,把不同书的笔记归类到一起</p>
          </div>
        }
      >
        <ul class="notebook-list">
          <For each={notebookStore.notebooks}>
            {(nb) => (
              <li
                class="notebook-item"
                onClick={() => navigate(`/notebook/${nb.id}`)}
              >
                <div class="notebook-item__icon">📓</div>
                <div class="notebook-item__body">
                  <h3 class="notebook-item__name">{nb.name}</h3>
                  <p class="text-secondary text-sm">
                    {annotationCount(nb.id)} 条标注
                  </p>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
