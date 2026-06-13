// 阅读器页 - M4 完善
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { annotationStore } from '@/stores/annotation';
import { mountReader } from '@/services/reader/mount';
import type { ReaderController, SelectionInfo } from '@/services/reader/types';
import { settingsStore } from '@/stores/settings';
import { ReaderToolbar } from '@/components/ReaderToolbar';
import { NoteInputDialog } from '@/components/NoteInputDialog';
import { TranslatePanel } from '@/components/TranslatePanel';
import type { AnnotationColor } from '@/types';

export default function BookReader() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  // 路由配置保证 :id 必存在
  const book = () => libraryStore.getById(params.id ?? '');
  const [error, setError] = createSignal<string | null>(null);
  const [controller, setController] = createSignal<ReaderController | null>(null);
  const [progress, setProgress] = createSignal<{ cfi?: string; page?: number; percentage: number }>({
    percentage: 0,
  });
  const [selection, setSelection] = createSignal<SelectionInfo | null>(null);
  const [showNoteDialog, setShowNoteDialog] = createSignal(false);
  const [noteMode, setNoteMode] = createSignal<'note' | 'standalone'>('note');
  const [showTranslate, setShowTranslate] = createSignal(false);

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
      });
      setController(ctrl);

      // 阅读偏好应用
      const pref = settingsStore.settings.preferences;
      ctrl.setFontSize(pref.fontSize);
      ctrl.setFontFamily(pref.fontFamily);
      ctrl.setTheme(pref.theme);
      ctrl.setLineHeight(pref.lineHeight);

      // 重画所有 annotation
      const annos = annotationStore.getByBook(b.id);
      if (b.format === 'pdf') {
        const pdfCtrl = ctrl as any;
        for (const a of annos) {
          if (a.locator?.page && a.locator.rects) {
            pdfCtrl.addHighlightByLocator(a.locator.page, a.locator.rects, a.color);
          }
        }
      } else {
        for (const a of annos) {
          if (a.locator?.cfiRange) {
            ctrl.addHighlight(a.locator.cfiRange, a.color, a.selectedText ?? '');
          }
        }
      }

      // 进度持久化
      const offProgress = ctrl.onProgress((p) => {
        setProgress(p);
        libraryStore.updateProgress(b.id, p);
      });

      // 选区
      const offSel = ctrl.onSelection((s) => {
        setSelection(s);
      });

      // 跳转:进度恢复优先,?anno= 其次
      const targetAnno =
        typeof search.anno === 'string' ? annotationStore.getById(search.anno) : undefined;
      if (targetAnno) {
        const loc = targetAnno.locator;
        if (loc?.cfiRange) await ctrl.focusAnnotation(loc.cfiRange);
        else if (loc?.page) await ctrl.focusAnnotation(loc.page);
      } else if (b.progress?.cfi) {
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
      controller()?.addHighlight(sel.cfiRange ?? String(sel.page ?? ''), color, sel.text);
      console.log('[BookReader] highlight saved', ann.id);
    } else if (action === 'note') {
      setNoteMode('note');
      setShowNoteDialog(true);
    } else if (action === 'ai') {
      navigate(
        `/book/${b.id}/ai?anno=${encodeURIComponent(sel.cfiRange ?? String(sel.page ?? ''))}`,
      );
    } else if (action === 'translate') {
      // 选区翻译:走 AI 面板(快捷)
      const target = settingsStore.settings.translation.targetLanguage;
      const text = `把下面这段翻译成 ${target}。只输出译文。\n\n${sel.text}`;
      navigate(
        `/book/${b.id}/ai?anno=${encodeURIComponent(sel.cfiRange ?? String(sel.page ?? ''))}`,
      );
      // 注:实际翻译由 AI 面板处理,这里只是入口
      console.log('[BookReader] translate selection:', text);
    }
  }

  function handleTranslatePage() {
    setShowTranslate(true);
  }

  function handleNoteConfirm(data: { noteText: string; color: AnnotationColor }) {
    const sel = selection();
    const b = book();
    if (!b) return;

    if (noteMode() === 'note' && sel) {
      annotationStore.add({
        bookId: b.id,
        type: 'highlight_note',
        locator: {
          cfiRange: sel.cfiRange,
          page: sel.page,
          rects: sel.rects,
          prefix: sel.prefix,
          suffix: sel.suffix,
        },
        selectedText: sel.text,
        noteText: data.noteText,
        color: data.color,
      });
      controller()?.addHighlight(sel.cfiRange ?? String(sel.page ?? ''), data.color, sel.text);
    } else if (noteMode() === 'standalone') {
      // 独立笔记(无选区) - 当前位置不固定,只记书 + 文本
      annotationStore.add({
        bookId: b.id,
        type: 'note',
        noteText: data.noteText,
        locator: sel
          ? {
              cfiRange: sel.cfiRange,
              page: sel.page,
              rects: sel.rects,
              prefix: sel.prefix,
              suffix: sel.suffix,
            }
          : undefined,
        color: data.color,
      });
    }
    setShowNoteDialog(false);
  }

  function handleStandaloneNote() {
    setNoteMode('standalone');
    setShowNoteDialog(true);
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
            bookId={params.id ?? ''}
            controller={controller()}
            progress={progress()}
            hasSelection={!!selection()}
            onSelectionAction={handleSelectionAction}
            onStandaloneNote={handleStandaloneNote}
            onTranslatePage={handleTranslatePage}
          />
        </Show>
        <div ref={containerRef} class="reader-container" />
        <NoteInputDialog
          open={showNoteDialog()}
          selectedText={selection()?.text}
          onConfirm={handleNoteConfirm}
          onCancel={() => setShowNoteDialog(false)}
        />
        <TranslatePanel
          open={showTranslate()}
          controller={controller()}
          onClose={() => setShowTranslate(false)}
        />
      </Show>
    </div>
  );
}
