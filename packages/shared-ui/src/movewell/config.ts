// Backend URLs, set once by apps/tv/App.tsx from EXPO_PUBLIC_* variables.
export interface PlayMotionConfig {
  apiUrl: string;
  wsUrl: string;
  phoneUrl: string;
}

let current: PlayMotionConfig = { apiUrl: '', wsUrl: '', phoneUrl: '' };

export function configurePlayMotion(config: PlayMotionConfig) {
  current = { ...config };
}

export const getPlayMotionConfig = (): PlayMotionConfig => current;
