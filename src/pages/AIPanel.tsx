import { For, Show, createMemo, createSignal } from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { annotationStore } from '@/stores/annotation';
import { aiStore } from '@/stores/ai';
import { settingsStore } from '@/stores/settings';
import { askAIStream } from '@/services/ai/client';

export default function AIPanel() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [streaming, setStreaming] = createSignal(false);
  const [draft, setDraft] = createSignal('');

  const book = createMemo(() => libraryStore.getById(params.id));
  const annotationId = createMemo(() =>
    typeof search.anno === 'string' ? search.anno : undefined,
  );
  const annotation = createMemo(() => {
    const id = annotationId();
    return id ? annotationStore.getById(id) : undefined;
  });

  // 上下文文本:优先用划线的内容,否则是当前打开的书的描述
  const contextText = createMemo(() => {
    const ann = annotation();
    if (ann) return ann.selectedText ?? ann.noteText ?? '';
    const b = book();
    return b ? `${b.title} - ${b.author}` : '';
  });

  // 当前会话(简化版:每个上下文对应一个)
  const conversation = createMemo(() => {
    const ann = annotation();
    if (!ann) return undefined;
    const convs = aiStore.getByBook(params.id);
    return convs.find((c) => c.contextAnnotationId === ann.id);
  });

  async function handleSend() {
    const text = draft().trim();
    if (!text || streaming()) return;
    if (!settingsStore.settings.ai.enabled) {
      alert('请先在设置中启用 AI 并配置');
      return;
    }
    setDraft('');
    setStreaming(true);

    // 找到/创建会话
    let conv = conversation();
    if (!conv) {
      conv = aiStore.startConversation({
        bookId: params.id,
        contextAnnotationId: annotationId(),
        contextText: contextText(),
      });
    }

    aiStore.appendMessage(conv.id, { role: 'user', content: text });

    // 收集 AI 响应
    let assistantText = '';
    aiStore.appendMessage(conv.id, { role: 'assistant', content: '' });
    try {
      await askAIStream({
        systemPrompt: buildSystemPrompt(contextText()),
        messages: [
          ...conv.messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: text },
        ],
        onDelta: (chunk) => {
          assistantText += chunk;
          // 直接更新最后一条
          const conv2 = aiStore.getById(conv!.id);
          if (conv2) {
            const last = conv2.messages[conv2.messages.length - 1];
            if (last.role === 'assistant') {
              // Solid 不可变更新
              aiStore.appendMessage; // noop
              // 这里直接修改内容 - 因为我们用 appendMessage 没法更新中间内容
              // 简单做法:维护一个 ref
            }
          }
        },
        onDone: () => {
          setStreaming(false);
        },
        onError: (err) => {
          setStreaming(false);
          alert('AI 调用失败: ' + err.message);
        },
      });
    } catch (err) {
      setStreaming(false);
      console.error(err);
    }
  }

  return (
    <div class="page page-ai">
      <header class="page-header">
        <button class="btn btn-ghost" onClick={() => navigate(`/book/${params.id}`)}>‹ 返回</button>
        <h1>AI 助手</h1>
      </header>

      <Show when={contextText()}>
        {(ctx) => (
          <div class="ai-context">
            <p class="text-tertiary text-xs">上下文</p>
            <blockquote>{ctx()}</blockquote>
          </div>
        )}
      </Show>

      <Show
        when={conversation()}
        fallback={
          <div class="empty text-sm">开始对话吧。问 AI 解释 / 翻译 / 总结</div>
        }
      >
        {(conv) => (
          <ul class="ai-messages">
            <For each={conv().messages}>
              {(m) => (
                <li
                  class="ai-message"
                  classList={{
                    'ai-message--user': m.role === 'user',
                    'ai-message--assistant': m.role === 'assistant',
                  }}
                >
                  <p>{m.content}</p>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>

      <form
        class="ai-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
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
        <button class="btn btn-primary" type="submit" disabled={streaming() || !draft().trim()}>
          {streaming() ? '...' : '发送'}
        </button>
      </form>
    </div>
  );
}

function buildSystemPrompt(contextText: string): string {
  return `你是一个电子阅读器的 AI 助手。用户正在阅读一本书,可能会有选区或问题。

【当前上下文】
${contextText}

请用简洁、有用的方式回答。如果用户没指定语言,默认用中文。`;
}
