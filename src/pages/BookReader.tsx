// 阅读器页 - M1 完整实现
// 挂载 reader、绑定选区、保存进度、跳转到 annotation
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { annotationStore } from '@/stores/annotation';
import { mountReader } from '@/services/reader/mount';
import type { ReaderController, SelectionInfo } from '@/services/reader/types';
import { settingsStore } from '@/stores/settings';
import { ReaderToolbar } from '@/components/ReaderToolbar';

export default function BookReader() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const book = () => libraryStore.getById(params.id);
  const [error, setError] = createSignal<string | null>(null);
  const [controller, setController] = createSignal<ReaderController | null>(null);
  const [progress, setProgress] = createSignal<{ cfi?: string; page?: number; percentage: number }>({
    percentage: 0,
  });
  const [selection, setSelection] = createSignal<SelectionInfo | null>(null);

  let containerRef: HTMLDivElement | undefined;

  onMount(async () => {
    const b = book();
    if (!b) {
      setError('书不存在');
      return;
    }
    if (!containerRef) return;

    try {
      const ctrl = await mountReader({
        container: containerRef,
        book: b,
        focusAnnotationId: typeof search.anno === 'string' ? search.anno : undefined,
      });
      setController(ctrl);

      // 应用阅读偏好
      const pref = settingsStore.settings.preferences;
      ctrl.setFontSize(pref.fontSize);
      ctrl.setFontFamily(pref.fontFamily);
      ctrl.setTheme(pref.theme);
      ctrl.setLineHeight(pref.lineHeight);

      // 进度持久化
      const offProgress = ctrl.onProgress((p) => {
        setProgress(p);
        libraryStore.updateProgress(b.id, p);
      });

      // 选区
      const offSel = ctrl.onSelection((s) => {
        setSelection(s);
      });

      // 恢复进度
      if (b.progress?.cfi) {
        await ctrl.goTo(b.progress.cfi);
      } else if (b.progress?.page) {
        await ctrl.goTo(b.progress.page);
      }

      onCleanup(() => {
        offProgress();
        offSel();
        ctrl.destroy();
      });
    } catch (err) {
      console.error('[BookReader] mount failed', err);
      setError((err as Error).message ?? '加载失败');
    }
  });

  function handleSelectionAction(action: 'highlight' | 'note' | 'ai' | 'translate') {
    const sel = selection();
    if (!sel) return;
    const b = book();
    if (!b) return;

    // M2:划线/笔记实际保存
    if (action === 'highlight') {
      const color = 'yellow';
      const ann = annotationStore.add({
        bookId: b.id,
        type: 'highlight',
        locator: {
          cfiRange: sel.cfiRange,
          page: sel.page,
          rects: sel.rects,
          prefix: sel.prefix,
          suffix: sel.suffix,
        },
        selectedText: sel.text,
        color,
      });
      controller()?.addHighlight(sel.cfiRange ?? String(sel.page), color, sel.text);
      console.log('[BookReader] highlight saved', ann.id);
    } else if (action === 'note') {
      const noteText = prompt('输入笔记内容:');
      if (noteText == null) return;
      const ann = annotationStore.add({
        bookId: b.id,
        type: 'note',
        noteText,
        locator: sel.cfiRange
          ? { cfiRange: sel.cfiRange, prefix: sel.prefix, suffix: sel.suffix }
          : sel.page
            ? { page: sel.page, rects: sel.rects, prefix: sel.prefix, suffix: sel.suffix }
            : undefined,
        color: 'yellow',
      });
      console.log('[BookReader] note saved', ann.id);
    } else if (action === 'ai') {
      // M4:跳 AI 面板
      navigate(`/book/${b.id}/ai?anno=${encodeURIComponent(sel.cfiRange ?? String(sel.page ?? ''))}`);
    } else if (action === 'translate') {
      // M4:整段翻译走 AI
      alert('翻译功能在 M4 实现 (AI 调用)');
    }
  }

  return (
    <div class="page page-reader" data-theme={settingsStore.settings.preferences.theme}>
      <Show
        when={!error()}
        fallback={
          <div class="empty">
            <p>无法打开这本书</p>
            <p class="text-secondary text-sm">{error()}</p>
          </div>
        }
      >
        <Show when={book()}>
          <ReaderToolbar
            bookId={params.id}
            controller={controller()}
            progress={progress()}
            hasSelection={!!selection()}
            onSelectionAction={handleSelectionAction}
          />
        </Show>
        <div ref={containerRef} class="reader-container" />
      </Show>
    </div>
  );
}
