'use client';

import { useCallback, useRef } from 'react';

export function usePokemonSound(name: string, description?: string, descLang?: string) {
  const descriptionRef = useRef(description);
  const descLangRef = useRef(descLang);
  descriptionRef.current = description;
  descLangRef.current = descLang;

  const playSound = useCallback(() => {
    if (!('speechSynthesis' in window) || !name) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(name);
    utterance.lang = 'en-US';
    utterance.rate = 0.7;
    utterance.pitch = 1.1;

    utterance.onend = () => {
      const desc = descriptionRef.current;
      if (!desc) return;
      window.speechSynthesis.cancel();
      const descUtterance = new SpeechSynthesisUtterance(desc);
      descUtterance.lang = descLangRef.current ?? 'en-US';
      descUtterance.rate = 0.85;
      descUtterance.pitch = 1.0;
      window.speechSynthesis.speak(descUtterance);
    };

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
