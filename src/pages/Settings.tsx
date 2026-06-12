import { Show, createSignal } from 'solid-js';
import { settingsStore } from '@/stores/settings';
import { signInWithApple, signOutApple } from '@/services/apple/auth';
import { isIOS, isTauri } from '@/services/platform';

export default function Settings() {
  const ai = () => settingsStore.settings.ai;
  const tr = () => settingsStore.settings.translation;
  const pref = () => settingsStore.settings.preferences;
  const apple = () => settingsStore.settings.appleUser;
  const [signingIn, setSigningIn] = createSignal(false);

  async function handleAppleSignIn() {
    setSigningIn(true);
    try {
      const user = await signInWithApple();
      if (user) settingsStore.setAppleUser(user);
    } catch (err) {
      console.error('[Settings] Apple sign-in failed', err);
      alert('Apple 登录失败: ' + (err as Error).message);
    } finally {
      setSigningIn(false);
    }
  }

  function handleAppleSignOut() {
    if (!confirm('确定退出 Apple 账号?')) return;
    signOutApple();
    settingsStore.setAppleUser(undefined);
  }

  return (
    <div class="page page-settings">
      <header class="page-header">
        <h1>设置</h1>
      </header>

      <section class="form-section">
        <h2>账号</h2>
        <Show
          when={apple()}
          fallback={
            <Show
              when={isTauri() && isIOS()}
              fallback={
                <p class="text-secondary text-sm">Apple 登录仅在 iOS 客户端可用。</p>
              }
            >
              <button
                class="btn btn-apple"
                onClick={handleAppleSignIn}
                disabled={signingIn()}
              >
                {signingIn() ? '登录中…' : ' 使用 Apple 登录'}
              </button>
            </Show>
          }
        >
          {(u) => (
            <div class="account-card">
              <div>
                <p class="account-card__name">{u().name ?? 'Apple 用户'}</p>
                <Show when={u().email}>
                  {(email) => <p class="text-secondary text-sm">{email()}</p>}
                </Show>
                <p class="text-tertiary text-xs">User ID: {u().userId.slice(0, 12)}…</p>
              </div>
              <button class="btn btn-ghost" onClick={handleAppleSignOut}>退出</button>
            </div>
          )}
        </Show>
        <p class="text-tertiary text-xs">其他登录方式(Google / 邮箱)后续加入。</p>
      </section>

      <section class="form-section">
        <h2>AI 助手</h2>
        <label class="form-label">
          <input
            type="checkbox"
            checked={ai().enabled}
            onChange={(e) => settingsStore.setAISettings({ enabled: e.currentTarget.checked })}
          />
          启用 AI 助手
        </label>
        <div class="col">
          <label class="form-label">Provider</label>
          <select
            class="input"
            value={ai().provider}
            onChange={(e) => settingsStore.setAISettings({ provider: e.currentTarget.value as 'openai' | 'openrouter' | 'ollama' | 'custom' })}
          >
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">Ollama (本地)</option>
            <option value="custom">自定义 OpenAI 兼容</option>
          </select>
        </div>
        <div class="col">
          <label class="form-label">Base URL</label>
          <input
            class="input"
            type="text"
            value={ai().baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => settingsStore.setAISettings({ baseUrl: e.currentTarget.value })}
          />
        </div>
        <div class="col">
          <label class="form-label">API Key</label>
          <input
            class="input"
            type="password"
            value={ai().apiKey}
            placeholder="sk-..."
            onChange={(e) => settingsStore.setAISettings({ apiKey: e.currentTarget.value })}
          />
        </div>
        <div class="col">
          <label class="form-label">Model</label>
          <input
            class="input"
            type="text"
            value={ai().model}
            placeholder="gpt-4o-mini"
            onChange={(e) => settingsStore.setAISettings({ model: e.currentTarget.value })}
          />
        </div>
        <p class="text-tertiary text-xs">API key 仅存本地;所有请求从设备直发到 provider。</p>
      </section>

      <section class="form-section">
        <h2>翻译</h2>
        <div class="col">
          <label class="form-label">目标语言</label>
          <select
            class="input"
            value={tr().targetLanguage}
            onChange={(e) => settingsStore.setTranslationSettings({ targetLanguage: e.currentTarget.value })}
          >
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>
        </div>
        <label class="form-label">
          <input
            type="checkbox"
            checked={tr().showOriginal}
            onChange={(e) => settingsStore.setTranslationSettings({ showOriginal: e.currentTarget.checked })}
          />
          整页翻译时显示原文(对照模式)
        </label>
        <p class="text-tertiary text-xs">翻译走 AI,和问答共用配置。</p>
      </section>

      <section class="form-section">
        <h2>阅读</h2>
        <div class="col">
          <label class="form-label">字号: {pref().fontSize}px</label>
          <input
            type="range"
            min="12"
            max="32"
            value={pref().fontSize}
            onChange={(e) => settingsStore.setPreferences({ fontSize: Number(e.currentTarget.value) })}
          />
        </div>
        <div class="col">
          <label class="form-label">字体</label>
          <select
            class="input"
            value={pref().fontFamily}
            onChange={(e) => settingsStore.setPreferences({ fontFamily: e.currentTarget.value as 'serif' | 'sans' | 'system' })}
          >
            <option value="serif">衬线 (宋体)</option>
            <option value="sans">无衬线</option>
            <option value="system">系统字体</option>
          </select>
        </div>
        <div class="col">
          <label class="form-label">主题</label>
          <select
            class="input"
            value={pref().theme}
            onChange={(e) => settingsStore.setPreferences({ theme: e.currentTarget.value as 'light' | 'dark' | 'sepia' })}
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="sepia">护眼(米黄)</option>
          </select>
        </div>
        <div class="col">
          <label class="form-label">行距: {pref().lineHeight.toFixed(1)}</label>
          <input
            type="range"
            min="1.0"
            max="2.5"
            step="0.1"
            value={pref().lineHeight}
            onChange={(e) => settingsStore.setPreferences({ lineHeight: Number(e.currentTarget.value) })}
          />
        </div>
      </section>

      <section class="form-section">
        <h2>关于</h2>
        <p class="text-secondary text-sm">
          AI读书 v0.1.0 · iOS 优先 · Tauri v2 + SolidJS
        </p>
        <p class="text-tertiary text-xs">
          Bundle ID: com.yuanzhongheng.ebook
        </p>
      </section>
    </div>
  );
}
