// Persistance localStorage : settings + dernier match (best-effort).
import { DEFAULT_SETTINGS_V1, SettingsSchemaV1, type Settings } from './schema';

const KEY_SETTINGS = 'belote.settings.v1';

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS_V1;
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS_V1;
    const parsed = JSON.parse(raw);
    const result = SettingsSchemaV1.safeParse(parsed);
    if (!result.success) return DEFAULT_SETTINGS_V1;
    return result.data;
  } catch {
    return DEFAULT_SETTINGS_V1;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
  } catch {
    /* quota / private mode : noop */
  }
}
