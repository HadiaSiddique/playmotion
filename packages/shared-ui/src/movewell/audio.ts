// Plays Polly voice lines (MP3 URLs from the backend). One line at a time: a new line stops the old one.
// Web uses the browser's Audio element; Android TV uses expo-audio.
import { Platform } from 'react-native';

let stopCurrent: (() => void) | null = null;

export function stopVoice() {
  stopCurrent?.();
  stopCurrent = null;
}

export async function playVoice(url: string | null | undefined) {
  if (!url) return;
  stopVoice();
  try {
    if (Platform.OS === 'web') {
      const AudioCtor = (globalThis as any).Audio;
      if (!AudioCtor) return;
      const audio = new AudioCtor(url);
      stopCurrent = () => audio.pause();
      await audio.play();
    } else {
      // Loaded lazily so the web bundle never needs the native module.
      const { createAudioPlayer } = require('expo-audio');
      const player = createAudioPlayer({ uri: url });
      stopCurrent = () => {
        try {
          player.pause();
          player.remove();
        } catch {
          /* already released */
        }
      };
      player.play();
    }
  } catch (err) {
    // Browsers block audio until the first click/keypress; voice is a bonus, never a blocker.
    console.warn('PlayMotion voice could not play', err);
  }
}
