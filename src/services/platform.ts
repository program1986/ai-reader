// 平台检测
import { isPlatform } from '@tauri-apps/plugin-os';

/** 是否在 Tauri 容器中 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 是否 iOS */
export function isIOS(): boolean {
  if (!isTauri()) return false;
  try {
    return isPlatform('ios');
  } catch {
    return false;
  }
}

/** 是否 Android */
export function isAndroid(): boolean {
  if (!isTauri()) return false;
  try {
    return isPlatform('android');
  } catch {
    return false;
  }
}

/** 是否 macOS */
export function isMacOS(): boolean {
  if (!isTauri()) return false;
  try {
    return isPlatform('macos');
  } catch {
    return false;
  }
}
