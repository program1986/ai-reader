import { createStore } from 'solid-js/store';
import type { Book, BookFormat } from '@/types';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY = 'ai-reader:library:v1';

const [books, setBooks] = createStore<Book[]>(loadInitial());

function loadInitial(): Book[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Book[];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (err) {
    console.error('[library] persist failed', err);
  }
}

export const libraryStore = {
  books,
  getById(id: string) {
    return books.find((b) => b.id === id);
  },
  addBook(input: { format: BookFormat; filePath: string; title: string; author: string; cover?: string }) {
    const book: Book = {
      id: uuid(),
      format: input.format,
      filePath: input.filePath,
      title: input.title,
      author: input.author,
      cover: input.cover,
      addedAt: Date.now(),
    };
    setBooks((prev) => [book, ...prev]);
    persist();
    return book;
  },
  removeBook(id: string) {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    persist();
  },
  updateProgress(id: string, progress: Book['progress']) {
    setBooks(
      (b) => b.id === id,
      (b) => ({ ...b, progress, lastReadAt: Date.now() }),
    );
    persist();
  },
  rename(id: string, title: string) {
    setBooks((b) => b.id === id, (b) => ({ ...b, title }));
    persist();
  },
};
