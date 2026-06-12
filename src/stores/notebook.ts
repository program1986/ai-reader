import { createStore, produce } from 'solid-js/store';
import type { Notebook, NotebookAnnotation } from '@/types';
import { v4 as uuid } from 'uuid';

const NB_KEY = 'ai-reader:notebooks:v1';
const LINK_KEY = 'ai-reader:notebook-annotations:v1';

const [notebooks, setNotebooks] = createStore<Notebook[]>(loadNotebooks());
const [links, setLinks] = createStore<NotebookAnnotation[]>(loadLinks());

function loadNotebooks(): Notebook[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NB_KEY);
    return raw ? (JSON.parse(raw) as Notebook[]) : [];
  } catch {
    return [];
  }
}

function loadLinks(): NotebookAnnotation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LINK_KEY);
    return raw ? (JSON.parse(raw) as NotebookAnnotation[]) : [];
  } catch {
    return [];
  }
}

function persistNotebooks() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NB_KEY, JSON.stringify(notebooks));
  } catch (err) {
    console.error('[notebook] persist failed', err);
  }
}

function persistLinks() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LINK_KEY, JSON.stringify(links));
  } catch (err) {
    console.error('[notebook] links persist failed', err);
  }
}

export const notebookStore = {
  notebooks,
  links,
  getById(id: string) {
    return notebooks.find((n) => n.id === id);
  },
  create(name: string, description?: string): Notebook {
    const nb: Notebook = {
      id: uuid(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotebooks(produce((arr) => arr.unshift(nb)));
    persistNotebooks();
    return nb;
  },
  rename(id: string, name: string) {
    setNotebooks(
      (n) => n.id === id,
      produce((n) => {
        n.name = name;
        n.updatedAt = Date.now();
      }),
    );
    persistNotebooks();
  },
  updateDescription(id: string, description: string) {
    setNotebooks(
      (n) => n.id === id,
      produce((n) => {
        n.description = description;
        n.updatedAt = Date.now();
      }),
    );
    persistNotebooks();
  },
  remove(id: string) {
    setNotebooks((arr) => arr.filter((n) => n.id !== id));
    setLinks((arr) => arr.filter((l) => l.notebookId !== id));
    persistNotebooks();
    persistLinks();
  },
  // M:N 关联
  getAnnotationIds(notebookId: string): string[] {
    return links.filter((l) => l.notebookId === notebookId).map((l) => l.annotationId);
  },
  getNotebookIds(annotationId: string): string[] {
    return links.filter((l) => l.annotationId === annotationId).map((l) => l.notebookId);
  },
  addAnnotation(notebookId: string, annotationId: string) {
    if (links.some((l) => l.notebookId === notebookId && l.annotationId === annotationId)) return;
    setLinks(produce((arr) => arr.push({ notebookId, annotationId, addedAt: Date.now() })));
    persistLinks();
  },
  removeAnnotation(notebookId: string, annotationId: string) {
    setLinks((arr) =>
      arr.filter((l) => !(l.notebookId === notebookId && l.annotationId === annotationId)),
    );
    persistLinks();
  },
  /**
   * 合并:把 src 的所有标注转移到 dst,然后删除 src
   */
  merge(srcId: string, dstId: string) {
    if (srcId === dstId) return;
    const srcAnnos = links.filter((l) => l.notebookId === srcId).map((l) => l.annotationId);
    for (const aid of srcAnnos) {
      this.addAnnotation(dstId, aid);
    }
    this.remove(srcId);
  },
};
