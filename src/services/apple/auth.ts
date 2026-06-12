// Apple Sign In 桥接
// - iOS 真机:invoke Tauri 命令,等待 Swift 端 ASAuthorization 完成
// - 非 iOS:抛错(由调用方决定是否降级)
//
// 取消 → 返回 null
// 失败 → 抛 Error(消息含 Apple 错误码)
//
// M6:实际 Swift 端需要在 Xcode 工程中接入 AppleSignIn.swift
// 详见 src-tauri/ios/AppleSignIn.swift 顶部注释
import { invoke } from '@tauri-apps/api/core';
import { isIOS, isTauri } from '@/services/platform';
import type { AppleUser } from '@/types';

/**
 * 调用 Apple Sign In,返回 user 信息
 * - 仅 iOS 真机可用
 * - 取消:返回 null
 * - 失败:throw Error
 */
export async function signInWithApple(): Promise<AppleUser | null> {
  if (!isTauri()) {
    throw new Error('Apple Sign In 仅在 Tauri 容器中可用');
  }
  if (!isIOS()) {
    throw new Error('Apple Sign In 仅在 iOS 上可用');
  }
  try {
    const result = await invoke<{
      user_id: string;
      identity_token: string;
      name?: string | null;
      email?: string | null;
    }>('plugin:apple-signin|sign_in_with_apple');
    if (!result?.user_id) {
      // Swift 端返回了空,通常表示出问题
      return null;
    }
    return {
      userId: result.user_id,
      identityToken: result.identity_token,
      name: result.name ?? undefined,
      email: result.email ?? undefined,
      signedInAt: Date.now(),
    };
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (msg.includes('取消') || msg.includes('cancel')) {
      return null;
    }
    throw new Error(msg);
  }
}

/**
 * 退出 Apple 账号
 * v1 没有服务端,只清本地状态
 * 真要做"撤销授权"需要 ASAuthorizationAppleIDProvider.getCredentialState
 * 配合后续同步后端再做
 */
export function signOutApple(): void {
  // 暂时只清前端状态,settingsStore.setAppleUser(undefined)
  // TODO(M-later):如果接 iCloud 同步,这里要撤销 token
}
