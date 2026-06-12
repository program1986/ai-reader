// Apple Sign In 桥接
// M0 stub,M6 实现
import type { AppleUser } from '@/types';

/**
 * 调用 Apple Sign In,返回 user 信息
 * iOS 端:走 ASAuthorization (AuthenticationServices)
 * 失败 / 取消:返回 null
 */
export async function signInWithApple(): Promise<AppleUser | null> {
  // M6 实现
  throw new Error('M0 stub: signInWithApple 将在 M6 实现');
}

export function signOutApple(): void {
  // M6 实现
  // 当前没有服务端,本地清空即可
}
