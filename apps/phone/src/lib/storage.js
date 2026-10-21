// localStorage can throw (private mode, blocked storage); every access is wrapped.
export const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(`movewell.${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(`movewell.${key}`, value);
    } catch {
      /* ignore */
    }
  },
};
