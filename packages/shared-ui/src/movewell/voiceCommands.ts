// Say "stop" (or "it hurts") to the TV screen itself. Web only (Chrome/Edge speech recognition): this is
// what makes voice stop work on a laptop, where the camera page runs inside a panel and browsers often
// limit speech recognition there. The phone page keeps its own listener too; either one pauses.
// Fire TV has no browser speech API, so on a real TV people use STOP on the phone or Back on the remote.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceStatus = 'unsupported' | 'starting' | 'listening' | 'blocked';
export type VoiceCommand = 'stop' | 'pain';

// The recogniser's language follows the coach language, so accents and local words are understood.
const LANG: Record<string, string> = { 'en-US': 'en-US', 'hi-IN': 'hi-IN', 'es-US': 'es-US', 'ar-AE': 'ar-AE' };
// Kept narrow on purpose: everyday words ("para" in Spanish) would pause the game by mistake.
const STOP = /\b(stop|stopp?ed|pause|enough|halt|alto|basta)\b|स्टॉप|रुको|रुकिए|बस करो|توقف|كفى/i;
const PAIN = /\b(pain|ouch|ow|hurts?|hurting|dolor|duele)\b|दर्द|درد|ألم|يؤلم/i;

/** Matches one recognised phrase; exported for tests. */
export function commandIn(text: string): VoiceCommand | null {
  if (PAIN.test(text)) return 'pain';
  if (STOP.test(text)) return 'stop';
  return null;
}

export function useVoiceCommands(enabled: boolean, language: string, onCommand: (c: VoiceCommand) => void): VoiceStatus {
  const Recognition = Platform.OS === 'web' && typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
  const [status, setStatus] = useState<VoiceStatus>(Recognition ? 'starting' : 'unsupported');
  const latest = useRef(onCommand);
  latest.current = onCommand;

  useEffect(() => {
    if (!Recognition || !enabled) return undefined;
    let active = true;
    let lastFired = 0;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.lang = LANG[language] ?? 'en-US';
    rec.onstart = () => setStatus('listening');
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        for (let j = 0; j < e.results[i].length; j++) {
          const cmd = commandIn(String(e.results[i][j].transcript));
          if (cmd && Date.now() - lastFired > 2000) {
            lastFired = Date.now();
            latest.current(cmd);
            return;
          }
        }
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
        setStatus('blocked');
      }
    };
    // Chrome ends recognition after a pause in speech; start again straight away.
    rec.onend = () => {
      if (!active) return;
      setTimeout(() => {
        try {
          rec.start();
        } catch {
          /* already running */
        }
      }, 250);
    };
    try {
      rec.start();
    } catch {
      setStatus('blocked');
    }
    return () => {
      active = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [Recognition, enabled, language]);

  return status;
}
