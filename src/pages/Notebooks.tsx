import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { notebookStore } from '@/stores/notebook';
import { annotationStore } from '@/stores/annotation';

type SortKey = 'name' | 'created' | 'updated' | 'count';

export default function Notebooks() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');
  const [sortBy, setSortBy] = createSignal<SortKey>('updated');
  const [search, setSearch] = createSignal('');

  const sorted = createMemo(() => {
    const list = notebookStore.notebooks.filter((n) =>
      n.name.toLowerCase().includes(search().toLowerCase()),
    );
    const k = sortBy();
    return [...list].sort((a, b) => {
      if (k === 'name') return a.name.localeCompare(b.name);
      if (k === 'created') return b.createdAt - a.createdAt;
      if (k === 'updated') return b.updatedAt - a.updatedAt;
      if (k === 'count') {
        return notebookStore.getAnnotationIds(b.id).length - notebookStore.getAnnotationIds(a.id).length;
      }
      return 0;
    });
  });

  function stats(notebookId: string) {
    const annos = notebookStore.getAnnotationIds(notebookId);
    const books = new Set(
      annos.map((aid) => annotationStore.getById(aid)?.bookId).filter(Boolean),
    );
    return { annos: annos.length, books: books.size };
  }

  function handleCreate(e: Event) {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    const nb = notebookStore.create(name, newDesc().trim() || undefined);
    setNewName('');
    setNewDesc('');
    setCreating(false);
    navigate(`/notebook/${nb.id}`);
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
        <form class="form-section" onSubmit={handleCreate}>
          <h2>新建笔记本</h2>
          <input
            class="input"
            type="text"
            placeholder="笔记本名称"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            autofocus
          />
          <textarea
            class="input"
            placeholder="描述(可选)"
            value={newDesc()}
            onInput={(e) => setNewDesc(e.currentTarget.value)}
            rows="2"
          />
          <div class="row" style={{ 'justify-content': 'flex-end' }}>
            <button type="button" class="btn" onClick={() => setCreating(false)}>
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              创建
            </button>
          </div>
        </form>
      </Show>

      <Show when={notebookStore.notebooks.length > 0}>
        <div class="filter-bar">
          <input
            class="input"
            type="text"
            placeholder="搜索笔记本…"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <select
            class="input"
            value={sortBy()}
            onChange={(e) => setSortBy(e.currentTarget.value as SortKey)}
            style={{ 'flex-shrink': '0' }}
          >
            <option value="updated">最近修改</option>
            <option value="created">最新创建</option>
            <option value="name">按名称</option>
            <option value="count">按条目数</option>
          </select>
        </div>
      </Show>

      <Show
        when={sorted().length > 0}
        fallback={
          <div class="empty">
            <p>{search() ? '没有匹配的笔记本' : '还没有笔记本'}</p>
            <Show when={!search()}>
              <p class="text-secondary text-sm">建一个笔记本,把不同书的笔记归类到一起</p>
            </Show>
          </div>
        }
      >
        <ul class="notebook-list">
          <For each={sorted()}>
            {(nb) => {
              const s = stats(nb.id);
              return (
                <li
                  class="notebook-item"
                  onClick={() => navigate(`/notebook/${nb.id}`)}
                >
                  <div class="notebook-item__icon">📓</div>
                  <div class="notebook-item__body">
                    <h3 class="notebook-item__name">{nb.name}</h3>
                    <p class="text-secondary text-sm">
                      {s.annos} 条标注 · {s.books} 本书
                    </p>
                    <Show when={nb.description}>
                      {(d) => <p class="text-tertiary text-xs">{d()}</p>}
                    </Show>
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </div>
  );
}
