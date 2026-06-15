// Bridge webview console to Rust ai-reader.log
// Tauri 2 iOS webview console 默认不进 os_log,通过 invoke('webview_log') 转到文件
import { invoke } from '@tauri-apps/api/core';

export async function wlog(level: 'info' | 'warn' | 'error', msg: string, extra?: unknown): Promise<void> {
  try {
    const full = extra !== undefined ? `${msg} | ${safeStr(extra)}` : msg;
    await invoke('webview_log', { level, msg: full });
  } catch {
    // fallback: 也写 console,避免 invoke 失败时丢日志
    const line = `[webview:${level}] ${msg}${extra !== undefined ? ' | ' + safeStr(extra) : ''}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

function safeStr(x: unknown): string {
  try {
    if (x instanceof Error) return `${x.name}: ${x.message}\n${x.stack ?? ''}`;
    if (typeof x === 'string') return x;
    return JSON.stringify(x, (_k, v) => {
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      return v;
    });
  } catch {
    return String(x);
  }
}
