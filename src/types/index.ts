// 共享类型定义

export type BookFormat = 'epub' | 'mobi' | 'pdf' | 'fb2' | 'cbz' | 'txt';

export interface Book {
  id: string;
  format: BookFormat;
  filePath: string;
  title: string;
  author: string;
  cover?: string;
  addedAt: number;
  lastReadAt?: number;
  progress?: BookProgress;
}

export interface BookProgress {
  cfi?: string; // EPUB/FB2/CBZ
  page?: number; // PDF
  percentage?: number;
}

export type AnnotationType = 'highlight' | 'note' | 'highlight_note';

export interface Annotation {
  id: string;
  bookId: string;
  type: AnnotationType;
  // 位置(可空,用于独立笔记)
  locator?: AnnotationLocator;
  // 选中的原文(划线有,独立笔记无)
  selectedText?: string;
  // 用户写的笔记(可空)
  noteText?: string;
  // 颜色
  color: AnnotationColor;
  createdAt: number;
  updatedAt: number;
}

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'red';

export interface AnnotationLocator {
  // EPUB/FB2/CBZ: CFI 范围
  cfiRange?: string;
  // PDF: 页码 + 矩形
  page?: number;
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
  // 纯文本偏移(用作 fallback / 跨格式定位)
  textOffset?: { start: number; end: number };
  // 选区前后的锚定文字(用于定位漂移修复)
  prefix?: string;
  suffix?: string;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookAnnotation {
  notebookId: string;
  annotationId: string;
  addedAt: number;
}

export interface AIConversation {
  id: string;
  bookId?: string;
  contextAnnotationId?: string;
  contextText: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  at: number;
}

export interface AISettings {
  enabled: boolean;
  provider: 'openai' | 'openrouter' | 'ollama' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TranslationSettings {
  targetLanguage: string; // BCP-47, e.g. "zh-CN" "en"
  showOriginal: boolean; // 对照模式:同时显示原文
}

export interface UserPreferences {
  fontSize: number;
  fontFamily: 'serif' | 'sans' | 'system';
  theme: 'light' | 'dark' | 'sepia';
  pageMode: 'paginated' | 'scrolled';
  lineHeight: number;
}

export interface AppleUser {
  userId: string; // stable opaque ID
  name?: string; // first-time only
  email?: string; // first-time only
  identityToken: string;
  signedInAt: number;
}

export interface AppSettings {
  ai: AISettings;
  translation: TranslationSettings;
  preferences: UserPreferences;
  appleUser?: AppleUser;
}

export const ANNOTATION_COLORS_HEX: Record<AnnotationColor, string> = {
  yellow: '#ffeb3b',
  green: '#4caf50',
  blue: '#2196f3',
  pink: '#e91e63',
  purple: '#9c27b0',
  red: '#f44336',
};
