import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';

// 路由表
// "/" Library (Tab 1)
// "/notebooks" Notebooks (Tab 2)
// "/notebook/:id" NotebookDetail
// "/notebook/:id/edit" NotebookEdit
// "/settings" Settings (Tab 3)
// "/book/:id" BookReader (全屏,无 TabBar)
// "/book/:id/notes" BookAnnotations
// "/book/:id/ai" AIPanel
const Library = lazy(() => import('@/pages/Library'));
const Notebooks = lazy(() => import('@/pages/Notebooks'));
const NotebookDetail = lazy(() => import('@/pages/NotebookDetail'));
const NotebookEdit = lazy(() => import('@/pages/NotebookEdit'));
const Settings = lazy(() => import('@/pages/Settings'));
const BookReader = lazy(() => import('@/pages/BookReader'));
const BookAnnotations = lazy(() => import('@/pages/BookAnnotations'));
const AIPanel = lazy(() => import('@/pages/AIPanel'));

export const routes: RouteDefinition[] = [
  { path: '/', component: Library },
  { path: '/notebooks', component: Notebooks },
  { path: '/notebook/:id', component: NotebookDetail },
  { path: '/notebook/:id/edit', component: NotebookEdit },
  { path: '/settings', component: Settings },
  { path: '/book/:id', component: BookReader },
  { path: '/book/:id/notes', component: BookAnnotations },
  { path: '/book/:id/ai', component: AIPanel },
  { path: '*', component: Library },
];
