'use client';

import { useCallback } from 'react';

export function usePokemonSound(id: number, name: string) {
  const playSound = useCallback(() => {
    const audio = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`
    );

    const speakName = () => {
      if (!('speechSynthesis' in window)) return;

      const utterance = new SpeechSynthesisUtterance(name);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      // Android Chrome may not have voices loaded yet
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          window.speechSynthesis.speak(utterance);
        };
      } else {
        window.speechSynthesis.speak(utterance);
      }
    };

    // Fallback: speak name even if audio never fires onended (missing .ogg, slow load)
    const fallback = setTimeout(speakName, 2000);

    audio.onended = () => {
      clearTimeout(fallback);
      speakName();
    };

    audio.onerror = () => {
      clearTimeout(fallback);
      speakName();
    };

    audio.play().catch(() => {
      clearTimeout(fallback);
      speakName();
    });
  }, [id, name]);

  return { playSound };
}
