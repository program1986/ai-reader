import { createStore } from 'solid-js/store';
import type { AppSettings, AISettings, TranslationSettings, UserPreferences } from '@/types';

const STORAGE_KEY = 'ai-reader:settings:v1';

const defaultSettings: AppSettings = {
  ai: {
    enabled: false,
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
  } satisfies AISettings,
  translation: {
    targetLanguage: 'zh-CN',
    showOriginal: true,
  } satisfies TranslationSettings,
  preferences: {
    fontSize: 18,
    fontFamily: 'serif',
    theme: 'light',
    pageMode: 'paginated',
    lineHeight: 1.6,
  } satisfies UserPreferences,
};

function loadInitial(): AppSettings {
  if (typeof localStorage === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      ai: { ...defaultSettings.ai, ...parsed.ai },
      translation: { ...defaultSettings.translation, ...parsed.translation },
      preferences: { ...defaultSettings.preferences, ...parsed.preferences },
    };
  } catch {
    return defaultSettings;
  }
}

const [settings, setSettings] = createStore<AppSettings>(loadInitial());

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[settings] persist failed', err);
  }
}

export const settingsStore = {
  settings,
  setAISettings(ai: Partial<AISettings>) {
    setSettings('ai', (prev) => ({ ...prev, ...ai }));
    persist();
  },
  setTranslationSettings(t: Partial<TranslationSettings>) {
    setSettings('translation', (prev) => ({ ...prev, ...t }));
    persist();
  },
  setPreferences(p: Partial<UserPreferences>) {
    setSettings('preferences', (prev) => ({ ...prev, ...p }));
    persist();
  },
  setAppleUser(user: AppSettings['appleUser']) {
    setSettings('appleUser', user);
    persist();
  },
  reset() {
    setSettings(defaultSettings);
    persist();
  },
};
