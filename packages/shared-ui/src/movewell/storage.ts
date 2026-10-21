// Small persistent key-value store (AsyncStorage on TV, localStorage on web). Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (k: string) => `movewell.${k}`;

export const store = {
  async get(k: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key(k));
    } catch {
      return null;
    }
  },
  async set(k: string, value: string) {
    try {
      await AsyncStorage.setItem(key(k), value);
    } catch {
      /* storage unavailable: the app still works for this session */
    }
  },
  async remove(k: string) {
    try {
      await AsyncStorage.removeItem(key(k));
    } catch {
      /* ignore */
    }
  },
};
