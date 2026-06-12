// AI 客户端 - M4 完整实现
// 走 OpenAI 兼容协议(/v1/chat/completions with stream=true)
// 支持:OpenAI / OpenRouter / Ollama / 自定义
//
// Tauri 端:用 @tauri-apps/plugin-http 绕过 CORS / Android cleartext
// Web 端:用 fetch
//
// 选 iOS 真机时,@tauri-apps/plugin-http 是首选,允许配置 dangerous 域
// 详见 https://v2.tauri.app/plugin/http/

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { settingsStore } from '@/stores/settings';
import { isTauri } from '@/services/platform';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AskAIOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  /** 温度,默认 0.7 */
  temperature?: number;
  /** 最大 token */
  maxTokens?: number;
  /** abort signal */
  signal?: AbortSignal;
}

interface ChatCompletionChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason?: string | null;
  }>;
}

/**
 * 流式调用 AI
 * 不抛出错误,所有错误走 onError
 */
export async function askAIStream(opts: AskAIOptions): Promise<void> {
  const ai = settingsStore.settings.ai;
  if (!ai.enabled) {
    opts.onError(new Error('AI 助手未启用'));
    return;
  }
  if (!ai.apiKey && ai.provider !== 'ollama') {
    opts.onError(new Error('未配置 API Key'));
    return;
  }

  const baseUrl = ai.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: ai.model,
    messages: [
      { role: 'system' as const, content: opts.systemPrompt },
      ...opts.messages,
    ],
    stream: true,
    temperature: opts.temperature ?? 0.7,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ai.apiKey) {
    headers['Authorization'] = `Bearer ${ai.apiKey}`;
  }

  try {
    const response = isTauri()
      ? await tauriFetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: opts.signal,
        })
      : await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: opts.signal,
        });

    if (!response.ok) {
      const text = await response.text();
      opts.onError(new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`));
      return;
    }

    // 流式解析 SSE
    const reader = response.body?.getReader();
    if (!reader) {
      opts.onError(new Error('No response body reader'));
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE:数据行以 "data: " 开头,以 \n\n 结束
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          opts.onDone();
          return;
        }
        try {
          const json = JSON.parse(payload) as ChatCompletionChunk;
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) opts.onDelta(delta);
        } catch {
          // 忽略非 JSON 行(注释、心跳等)
        }
      }
    }
    opts.onDone();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      opts.onError(new Error('请求已取消'));
    } else {
      opts.onError(err as Error);
    }
  }
}

/**
 * 翻译整页
 * 走 AI,目标语言从 settings.translation.targetLanguage 取
 * 返回:流式 → onDelta 增量,onDone 完成
 */
export async function translatePage(
  pageText: string,
  onDelta: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  options?: { sourceLang?: string; signal?: AbortSignal },
): Promise<void> {
  const target = settingsStore.settings.translation.targetLanguage;
  const showOriginal = settingsStore.settings.translation.showOriginal;
  const source = options?.sourceLang ?? 'auto';

  const systemPrompt = `你是一个翻译引擎。把用户提供的内容翻译成目标语言: ${target}。${
    showOriginal ? '同时保留原文' : '只输出译文'
  }。保持原文的格式(段落、换行)。不要加解释,不要加注释,不要加 markdown 代码块标记。${
    source !== 'auto' ? `原文语言: ${source}` : ''
  }`;

  return askAIStream({
    systemPrompt,
    messages: [{ role: 'user', content: pageText }],
    onDelta,
    onDone,
    onError,
    temperature: 0.3,
    signal: options?.signal,
  });
}

/**
 * 解释选中的文本(短问答)
 */
export async function explainSelection(
  selectedText: string,
  onDelta: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const systemPrompt =
    '你是电子阅读器中的解释助手。用户在阅读时遇到了一个词或一段话,想理解它。请简洁地解释,语言视用户输入而定。';
  return askAIStream({
    systemPrompt,
    messages: [{ role: 'user', content: selectedText }],
    onDelta,
    onDone,
    onError,
    temperature: 0.3,
    signal: options?.signal,
  });
}

/**
 * 翻译选中的文本
 */
export async function translateSelection(
  selectedText: string,
  onDelta: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const target = settingsStore.settings.translation.targetLanguage;
  const systemPrompt = `把用户提供的文本翻译成 ${target}。保持原文格式。只输出译文,不要解释。`;
  return askAIStream({
    systemPrompt,
    messages: [{ role: 'user', content: selectedText }],
    onDelta,
    onDone,
    onError,
    temperature: 0.3,
    signal: options?.signal,
  });
}
