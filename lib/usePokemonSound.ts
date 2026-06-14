'use client';

import { useCallback } from 'react';

export function usePokemonSound(name: string) {
  const playSound = useCallback(() => {
    if (!('speechSynthesis' in window) || !name) return;

    // Cancel any queued speech before speaking to prevent accumulation
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(name);
    utterance.lang = 'en-US';
    utterance.rate = 0.7;
    utterance.pitch = 1.1;

    // Android Chrome may not have voices loaded yet on first call
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.speak(utterance);
      };
    } else {
      window.speechSynthesis.speak(utterance);
    }
  }, [name]);

  return { playSound };
}
