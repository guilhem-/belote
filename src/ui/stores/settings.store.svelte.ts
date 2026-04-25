import { DEFAULT_SETTINGS_V1, type Settings } from '@persistence/schema';
import { loadSettings, saveSettings } from '@persistence/store';

function makeStore() {
  let value = $state<Settings>(loadSettings());

  function set(updater: (current: Settings) => Settings): void {
    value = updater(value);
    saveSettings(value);
  }

  return {
    get value(): Settings {
      return value;
    },
    set,
    reset(): void {
      value = DEFAULT_SETTINGS_V1;
      saveSettings(value);
    },
  };
}

export const settingsStore = makeStore();
