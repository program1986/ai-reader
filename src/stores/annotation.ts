import { createStore, produce } from 'solid-js/store';
import type { Annotation, AnnotationColor, AnnotationLocator, AnnotationType } from '@/types';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY = 'ai-reader:annotations:v1';

const [annotations, setAnnotations] = createStore<Annotation[]>(loadInitial());

function loadInitial(): Annotation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Annotation[];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  } catch (err) {
    console.error('[annotation] persist failed', err);
  }
}

export const annotationStore = {
  annotations,
  getById(id: string) {
    return annotations.find((a) => a.id === id);
  },
  getByBook(bookId: string) {
    return annotations.filter((a) => a.bookId === bookId);
  },
  add(input: {
    bookId: string;
    type: AnnotationType;
    locator?: AnnotationLocator;
    selectedText?: string;
    noteText?: string;
    color?: AnnotationColor;
  }): Annotation {
    const ann: Annotation = {
      id: uuid(),
      bookId: input.bookId,
      type: input.type,
      locator: input.locator,
      selectedText: input.selectedText,
      noteText: input.noteText,
      color: input.color ?? 'yellow',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setAnnotations(produce((arr) => arr.unshift(ann)));
    persist();
    return ann;
  },
  update(id: string, patch: Partial<Pick<Annotation, 'noteText' | 'color' | 'selectedText' | 'type'>>) {
    setAnnotations(
      (a) => a.id === id,
      produce((a) => {
        Object.assign(a, patch);
        a.updatedAt = Date.now();
      }),
    );
    persist();
  },
  remove(id: string) {
    setAnnotations((arr) => arr.filter((a) => a.id !== id));
    persist();
  },
  removeByBook(bookId: string) {
    setAnnotations((arr) => arr.filter((a) => a.bookId !== bookId));
    persist();
  },
};
