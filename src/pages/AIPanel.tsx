// AI 面板 - M4 完整实现
import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { annotationStore } from '@/stores/annotation';
import { aiStore } from '@/stores/ai';
import { settingsStore } from '@/stores/settings';
import { askAIStream, explainSelection, translateSelection } from '@/services/ai/client';
import { marked } from 'marked';

export default function AIPanel() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [streaming, setStreaming] = createSignal(false);
  const [draft, setDraft] = createSignal('');
  const [abortCtrl, setAbortCtrl] = createSignal<AbortController | null>(null);

  const book = createMemo(() => libraryStore.getById(params.id ?? ''));
  const annotationId = createMemo(() =>
    typeof search.anno === 'string' ? search.anno : undefined,
  );
  const annotation = createMemo(() => {
    const id = annotationId();
    return id ? annotationStore.getById(id) : undefined;
  });

  const contextText = createMemo(() => {
    const ann = annotation();
    if (ann) return ann.selectedText ?? ann.noteText ?? '';
    return '';
  });

  const conversation = createMemo(() => {
    const ann = annotation();
    if (!ann) return undefined;
    return aiStore.getByBook(params.id ?? '').find((c) => c.contextAnnotationId === ann.id);
  });

  function getOrCreateConv(systemPrompt: string) {
    const ann = annotation();
    let conv = conversation();
    if (!conv) {
      conv = aiStore.startConversation({
        bookId: params.id,
        contextAnnotationId: ann?.id,
        contextText: contextText(),
      });
      if (systemPrompt) {
        aiStore.appendMessage(conv.id, { role: 'system', content: systemPrompt });
      }
    }
    return conv;
  }

  async function handleAsk() {
    const text = draft().trim();
    if (!text || streaming()) return;
    if (!settingsStore.settings.ai.enabled) {
      alert('请先在设置中启用 AI 并配置');
      return;
    }
    setDraft('');
    const sys = buildSystemPrompt(contextText());
    const conv = getOrCreateConv(sys);
    aiStore.appendMessage(conv.id, { role: 'user', content: text });
    await runStream(conv.id, sys, [
      ...conv.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]);
  }

  async function handleExplain() {
    if (!contextText()) return;
    if (!settingsStore.settings.ai.enabled) return alert('请先在设置中启用 AI');
    const sys = '你是阅读时的解释助手。简短、有用。';
    const conv = getOrCreateConv(sys);
    aiStore.appendMessage(conv.id, { role: 'user', content: `请解释:「${contextText()}」` });
    await runSimpleStream(conv.id, explainSelection, contextText());
  }

  async function handleTranslate() {
    if (!contextText()) return;
    if (!settingsStore.settings.ai.enabled) return alert('请先在设置中启用 AI');
    const sys = '你是翻译引擎。';
    const conv = getOrCreateConv(sys);
    aiStore.appendMessage(conv.id, { role: 'user', content: contextText() });
    await runSimpleStream(conv.id, translateSelection, contextText());
  }

  function runSimpleStream(
    convId: string,
    fn: (
      input: string,
      onDelta: (c: string) => void,
      onDone: () => void,
      onError: (e: Error) => void,
      opts?: { signal?: AbortSignal },
    ) => Promise<void>,
    input: string,
  ): Promise<void> {
    return runStream(convId, '你是助手。', [
      { role: 'user' as const, content: input },
    ]);
  }

  async function runStream(convId: string, systemPrompt: string, messages: any[]) {
    setStreaming(true);
    const ac = new AbortController();
    setAbortCtrl(ac);
    aiStore.appendMessage(convId, { role: 'assistant', content: '' });
    let assistantText = '';
    await askAIStream({
      systemPrompt,
      messages,
      onDelta: (chunk) => {
        assistantText += chunk;
        aiStore.updateLastMessage(convId, assistantText);
      },
      onDone: () => {
        setStreaming(false);
        setAbortCtrl(null);
      },
      onError: (err) => {
        setStreaming(false);
        setAbortCtrl(null);
        alert('AI 调用失败: ' + err.message);
      },
      signal: ac.signal,
    });
  }

  function handleStop() {
    abortCtrl()?.abort();
    setStreaming(false);
  }

  function handleClear() {
    const conv = conversation();
    if (!conv) return;
    if (!confirm('清空这个对话?')) return;
    aiStore.remove(conv.id);
  }

  onCleanup(() => {
    abortCtrl()?.abort();
  });

  const visibleMessages = createMemo(() => {
    const c = conversation();
    if (!c) return [];
    return c.messages.filter((m) => m.role !== 'system');
  });

  return (
    <div class="page page-ai">
      <header class="page-header">
        <button class="btn btn-ghost" onClick={() => navigate(`/book/${params.id}`)}>‹ 返回</button>
        <h1>AI 助手</h1>
        <Show when={conversation()}>
          <button class="btn btn-ghost" onClick={handleClear}>清空</button>
        </Show>
      </header>

      <Show when={contextText()}>
        {(ctx) => (
          <div class="ai-context">
            <p class="text-tertiary text-xs">上下文</p>
            <blockquote>{ctx()}</blockquote>
            <div class="row" style={{ 'margin-top': 'var(--space-2)' }}>
              <button class="btn btn-sm" onClick={handleExplain}>解释</button>
              <button class="btn btn-sm" onClick={handleTranslate}>
                译为 {settingsStore.settings.translation.targetLanguage}
              </button>
            </div>
          </div>
        )}
      </Show>

      <Show
        when={visibleMessages().length > 0}
        fallback={
          <div class="empty text-sm">
            <Show
              when={!settingsStore.settings.ai.enabled}
              fallback={<p>开始对话吧。问 AI 解释 / 翻译 / 总结</p>}
            >
              <p class="text-danger">AI 助手未启用</p>
              <p class="text-secondary text-sm">在"设置 → AI 助手"里开启</p>
            </Show>
          </div>
        }
      >
        <ul class="ai-messages">
          <For each={visibleMessages()}>
            {(m) => (
              <li
                class="ai-message"
                classList={{
                  'ai-message--user': m.role === 'user',
                  'ai-message--assistant': m.role === 'assistant',
                }}
              >
                <Show
                  when={m.role === 'assistant'}
                  fallback={<p>{m.content}</p>}
                >
                  <div class="markdown" innerHTML={marked.parse(m.content || '...') as string} />
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <form
        class="ai-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
      >
        <input
          class="input"
          type="text"
          placeholder="问 AI..."
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          disabled={streaming()}
        />
        <Show
          when={streaming()}
          fallback={
            <button class="btn btn-primary" type="submit" disabled={!draft().trim()}>
              发送
            </button>
          }
        >
          <button class="btn btn-danger" type="button" onClick={handleStop}>
            停止
          </button>
        </Show>
      </form>
    </div>
  );
}

function buildSystemPrompt(contextText: string): string {
  return `你是一个电子阅读器的 AI 助手。用户正在阅读一本书,可能会有选区或问题。

【当前上下文】
${contextText || '(无)'}

请用简洁、有用的方式回答。如果用户没指定语言,默认用中文。可以用 markdown 格式。`;
}
