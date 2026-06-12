import { useLocation, useNavigate } from '@solidjs/router';
import { Show } from 'solid-js';

const TABS = [
  { path: '/', label: '书架', icon: LibraryIcon },
  { path: '/notebooks', label: '笔记本', icon: NotebookIcon },
  { path: '/settings', label: '设置', icon: SettingsIcon },
] as const;

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav class="tab-bar">
      {TABS.map((tab) => (
        <button
          type="button"
          class="tab-bar__item"
          classList={{ 'tab-bar__item--active': isActive(tab.path) }}
          onClick={() => navigate(tab.path)}
        >
          <Show when={tab.icon}>{(icon) => <span class="tab-bar__icon">{icon()}</span>}</Show>
          <span class="tab-bar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

// 占位 SVG 图标 - 后期换成 lucide 或 react-icons 等价物
function LibraryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 4h4v16H3zM10 4h4v16h-4zM17 4l3 16-4 1-3-16z" />
    </svg>
  );
}
function NotebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 4h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H4z" />
      <path d="M4 4v19" />
      <path d="M8 8h8M8 12h8M8 16h6" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
