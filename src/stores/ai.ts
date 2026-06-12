import { createStore, produce } from 'solid-js/store';
import type { AIConversation, AIMessage } from '@/types';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY = 'ai-reader:ai-conversations:v1';

const [conversations, setConversations] = createStore<AIConversation[]>(loadInitial());

function loadInitial(): AIConversation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AIConversation[]) : [];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (err) {
    console.error('[ai] persist failed', err);
  }
}

export const aiStore = {
  conversations,
  getById(id: string) {
    return conversations.find((c) => c.id === id);
  },
  getByBook(bookId: string) {
    return conversations.filter((c) => c.bookId === bookId);
  },
  startConversation(input: { bookId?: string; contextAnnotationId?: string; contextText: string }): AIConversation {
    const conv: AIConversation = {
      id: uuid(),
      bookId: input.bookId,
      contextAnnotationId: input.contextAnnotationId,
      contextText: input.contextText,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(produce((arr) => arr.unshift(conv)));
    persist();
    return conv;
  },
  appendMessage(conversationId: string, msg: Omit<AIMessage, 'id' | 'at'>) {
    setConversations(
      (c) => c.id === conversationId,
      produce((c) => {
        c.messages.push({ ...msg, id: uuid(), at: Date.now() });
        c.updatedAt = Date.now();
      }),
    );
    persist();
  },
  remove(id: string) {
    setConversations((arr) => arr.filter((c) => c.id !== id));
    persist();
  },
  clear() {
    setConversations([]);
    persist();
  },
};
