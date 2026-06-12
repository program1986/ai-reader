import type { ParentComponent } from 'solid-js';
import { Suspense } from 'solid-js';
import { TabBar } from '@/components/TabBar';
import { useLocation } from '@solidjs/router';

export const App: ParentComponent = (props) => {
  const location = useLocation();

  // TabBar 在阅读器/AI 全屏页隐藏
  const showTabBar = () => {
    const path = location.pathname;
    return (
      path === '/' ||
      path === '/notebooks' ||
      path === '/settings' ||
      path.startsWith('/notebooks')
    );
  };

  return (
    <div class="app-shell">
      <Suspense fallback={<div class="loading">加载中...</div>}>
        {props.children}
      </Suspense>
      {showTabBar() && <TabBar />}
    </div>
  );
};
