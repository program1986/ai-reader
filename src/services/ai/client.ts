// AI 客户端 - 走 OpenAI 兼容协议
// M0 stub,M4 实现
import { settingsStore } from '@/stores/settings';

export interface AskAIOptions {
  systemPrompt: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/**
 * 调用 AI,流式输出
 * 默认走 OpenAI 兼容协议(/chat/completions with stream=true)
 * 支持 OpenAI / OpenRouter / Ollama / 自定义
 */
export async function askAIStream(opts: AskAIOptions): Promise<void> {
  // M4 实现
  throw new Error('M0 stub: askAIStream 将在 M4 实现');
}

/**
 * 翻译整页
 * 走 AI,目标语言从 settings.translation.targetLanguage 取
 */
export async function translatePage(
  pageText: string,
  _sourceLang?: string,
  onDelta: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): Promise<void> {
  const target = settingsStore.settings.translation.targetLanguage;
  const systemPrompt = `你是一个翻译引擎。把用户提供的内容翻译成目标语言: ${target}。保持原文的格式(段落、换行)。只输出译文,不要解释。`;
  return askAIStream({
    systemPrompt,
    messages: [{ role: 'user', content: pageText }],
    onDelta,
    onDone,
    onError,
  });
}
