// 整页翻译面板
// 用户点 "翻译整页" → 弹窗显示原文 + 翻译(对照式)
import { Show, createSignal, onCleanup } from 'solid-js';
import { translatePage } from '@/services/ai/client';
import { settingsStore } from '@/stores/settings';
import type { ReaderController } from '@/services/reader/types';

interface TranslatePanelProps {
  open: boolean;
  controller: ReaderController | null;
  onClose: () => void;
}

export function TranslatePanel(props: TranslatePanelProps) {
  const [original, setOriginal] = createSignal('');
  const [translated, setTranslated] = createSignal('');
  const [translating, setTranslating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [abortCtrl, setAbortCtrl] = createSignal<AbortController | null>(null);

  let started = false;

  async function startTranslation() {
    if (!props.controller) return;
    if (!settingsStore.settings.ai.enabled) {
      setError('请先在设置中启用 AI');
      return;
    }
    setError(null);
    setTranslated('');
    setTranslating(true);
    const text = await props.controller.getPageText();
    setOriginal(text);
    const ac = new AbortController();
    setAbortCtrl(ac);
    await translatePage(
      text,
      (chunk) => setTranslated((t) => t + chunk),
      () => {
        setTranslating(false);
        setAbortCtrl(null);
      },
      (err) => {
        setTranslating(false);
        setAbortCtrl(null);
        setError(err.message);
      },
      { signal: ac.signal },
    );
  }

  function handleStop() {
    abortCtrl()?.abort();
    setTranslating(false);
  }

  // 当 open 变 true 时自动启动
  if (props.open && !started) {
    started = true;
    startTranslation();
  }
  if (!props.open) {
    started = false;
    setOriginal('');
    setTranslated('');
    setError(null);
  }

  onCleanup(() => {
    abortCtrl()?.abort();
  });

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <header class="row">
            <h2 style={{ 'flex': '1' }}>整页翻译</h2>
            <span class="text-tertiary text-sm">
              → {settingsStore.settings.translation.targetLanguage}
            </span>
            <button class="btn btn-ghost" onClick={props.onClose}>×</button>
          </header>

          <Show when={error()}>
            {(e) => <p class="text-danger text-sm">⚠ {e()}</p>}
          </Show>

          <Show when={settingsStore.settings.translation.showOriginal}>
            <div class="translate-original">
              <h3 class="text-secondary text-sm">原文</h3>
              <p style={{ 'white-space': 'pre-wrap' }}>{original() || '...'}</p>
            </div>
          </Show>

          <div class="translate-result">
            <h3 class="text-secondary text-sm">译文</h3>
            <p style={{ 'white-space': 'pre-wrap' }}>
              {translated() || (translating() ? '翻译中...' : '...')}
            </p>
          </div>

          <div class="row" style={{ 'justify-content': 'flex-end' }}>
            <Show
              when={translating()}
              fallback={<button class="btn" onClick={props.onClose}>关闭</button>}
            >
              <button class="btn btn-danger" onClick={handleStop}>停止</button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
