// 阅读器顶部 + 底部工具栏
import { Show, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { settingsStore } from '@/stores/settings';
import type { ReaderController } from '@/services/reader/types';

interface ReaderToolbarProps {
  bookId: string;
  controller: ReaderController | null;
  progress: { cfi?: string; page?: number; percentage: number };
  onSelectionAction?: (action: 'highlight' | 'note' | 'ai' | 'translate') => void;
  hasSelection?: boolean;
}

export function ReaderToolbar(props: ReaderToolbarProps) {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = createSignal(false);

  const pref = () => settingsStore.settings.preferences;
  const tr = () => settingsStore.settings.translation;

  return (
    <>
      <header class="reader-toolbar">
        <button
          class="reader-toolbar__btn"
          onClick={() => navigate('/')}
          aria-label="返回书架"
        >
          ‹
        </button>
        <h1 class="reader-toolbar__title">阅读</h1>
        <button
          class="reader-toolbar__btn"
          onClick={() => navigate(`/book/${props.bookId}/notes`)}
          aria-label="查看笔记"
        >
          ☰
        </button>
        <button
          class="reader-toolbar__btn"
          onClick={() => setShowSettings(!showSettings())}
          aria-label="设置"
        >
          Aa
        </button>
      </header>

      <Show when={showSettings()}>
        <div class="reader-settings">
          <div class="row">
            <span class="text-secondary text-sm">字号</span>
            <button
              class="btn btn-sm"
              onClick={() =>
                settingsStore.setPreferences({
                  fontSize: Math.max(12, pref().fontSize - 2),
                })
              }
            >
              −
            </button>
            <span class="text-sm">{pref().fontSize}px</span>
            <button
              class="btn btn-sm"
              onClick={() =>
                settingsStore.setPreferences({
                  fontSize: Math.min(32, pref().fontSize + 2),
                })
              }
            >
              ＋
            </button>
          </div>
          <div class="row">
            <span class="text-secondary text-sm">行距</span>
            <input
              type="range"
              min="1.0"
              max="2.5"
              step="0.1"
              value={pref().lineHeight}
              onChange={(e) => {
                const v = Number(e.currentTarget.value);
                settingsStore.setPreferences({ lineHeight: v });
                props.controller?.setLineHeight(v);
              }}
            />
            <span class="text-sm">{pref().lineHeight.toFixed(1)}</span>
          </div>
          <div class="row">
            <span class="text-secondary text-sm">字体</span>
            <select
              class="input input--sm"
              value={pref().fontFamily}
              onChange={(e) => {
                const v = e.currentTarget.value as 'serif' | 'sans' | 'system';
                settingsStore.setPreferences({ fontFamily: v });
                props.controller?.setFontFamily(v);
              }}
            >
              <option value="serif">宋体</option>
              <option value="sans">黑体</option>
              <option value="system">系统</option>
            </select>
          </div>
          <div class="row">
            <span class="text-secondary text-sm">主题</span>
            <button
              class="filter-chip"
              classList={{ 'filter-chip--active': pref().theme === 'light' }}
              onClick={() => {
                settingsStore.setPreferences({ theme: 'light' });
                props.controller?.setTheme('light');
              }}
            >
              浅
            </button>
            <button
              class="filter-chip"
              classList={{ 'filter-chip--active': pref().theme === 'sepia' }}
              onClick={() => {
                settingsStore.setPreferences({ theme: 'sepia' });
                props.controller?.setTheme('sepia');
              }}
            >
              米
            </button>
            <button
              class="filter-chip"
              classList={{ 'filter-chip--active': pref().theme === 'dark' }}
              onClick={() => {
                settingsStore.setPreferences({ theme: 'dark' });
                props.controller?.setTheme('dark');
              }}
            >
              深
            </button>
          </div>
        </div>
      </Show>

      <Show when={props.hasSelection}>
        <div class="selection-toolbar">
          <button
            class="selection-toolbar__btn"
            onClick={() => props.onSelectionAction?.('highlight')}
          >
            🖍 划线
          </button>
          <button
            class="selection-toolbar__btn"
            onClick={() => props.onSelectionAction?.('note')}
          >
            📝 笔记
          </button>
          <button
            class="selection-toolbar__btn"
            onClick={() => props.onSelectionAction?.('ai')}
          >
            ✨ 问 AI
          </button>
          <button
            class="selection-toolbar__btn"
            onClick={() => props.onSelectionAction?.('translate')}
          >
            🌐 译{tr().targetLanguage}
          </button>
        </div>
      </Show>

      <footer class="reader-footer">
        <span class="text-sm text-secondary">
          {props.progress.page
            ? `第 ${props.progress.page} 页`
            : props.progress.cfi
              ? `${(props.progress.percentage * 100).toFixed(1)}%`
              : ''}
        </span>
        <span class="spacer" />
        <button class="reader-toolbar__btn" onClick={() => props.controller?.prev()}>
          ‹
        </button>
        <button class="reader-toolbar__btn" onClick={() => props.controller?.next()}>
          ›
        </button>
      </footer>
    </>
  );
}
