// 阅读器页 - M1 完整实现,M0 阶段是占位
import { Show, createSignal, onMount } from 'solid-js';
import { useParams, useSearchParams } from '@solidjs/router';
import { libraryStore } from '@/stores/library';
import { mountReader } from '@/services/reader/mount';

export default function BookReader() {
  const params = useParams();
  const [search] = useSearchParams();
  const book = () => libraryStore.getById(params.id);
  const [error, setError] = createSignal<string | null>(null);

  let containerRef: HTMLDivElement | undefined;
  let cleanup: (() => void) | null = null;

  onMount(() => {
    const b = book();
    if (!b) {
      setError('书不存在');
      return;
    }
    if (!containerRef) return;
    mountReader({
      container: containerRef,
      book: b,
      focusAnnotationId: typeof search.anno === 'string' ? search.anno : undefined,
    })
      .then((c) => {
        cleanup = c;
      })
      .catch((err) => {
        console.error('[BookReader] mount failed', err);
        setError((err as Error).message ?? '加载失败');
      });
  });

  return (
    <div class="page page-reader">
      <Show
        when={!error()}
        fallback={
          <div class="empty">
            <p>无法打开这本书</p>
            <p class="text-secondary text-sm">{error()}</p>
          </div>
        }
      >
        <div ref={containerRef} class="reader-container" />
      </Show>
    </div>
  );
}
