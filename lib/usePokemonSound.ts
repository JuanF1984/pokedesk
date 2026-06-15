'use client';

import { useCallback, useRef } from 'react';

export function usePokemonSound(
  name: string,
  typeText?: string,
  description?: string,
  descLang?: string,
) {
  const typeTextRef = useRef(typeText);
  const descriptionRef = useRef(description);
  const descLangRef = useRef(descLang);
  typeTextRef.current = typeText;
  descriptionRef.current = description;
  descLangRef.current = descLang;

  const playSound = useCallback(() => {
    if (!('speechSynthesis' in window) || !name) return;

    const speak = () => {
      const nombreUtterance = new SpeechSynthesisUtterance(name);
      nombreUtterance.lang = 'en-US';
      nombreUtterance.rate = 0.9;
      nombreUtterance.pitch = 1.1;

      nombreUtterance.onend = () => {
        const tipo = typeTextRef.current;
        if (!tipo) return;
        window.speechSynthesis.cancel();

        const tipoUtterance = new SpeechSynthesisUtterance(tipo);
        tipoUtterance.lang = 'es-MX';
        tipoUtterance.rate = 0.85;
        tipoUtterance.pitch = 1.0;

        tipoUtterance.onend = () => {
          const desc = descriptionRef.current;
          if (!desc) return;
          window.speechSynthesis.cancel();

          const descUtterance = new SpeechSynthesisUtterance(desc);
          descUtterance.lang = descLangRef.current ?? 'en-US';
          descUtterance.rate = 0.85;
          descUtterance.pitch = 1.0;
          window.speechSynthesis.speak(descUtterance);
        };

        window.speechSynthesis.speak(tipoUtterance);
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(nombreUtterance);
    };

    // Android Chrome may not have voices loaded yet on first call
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speak();
      };
    } else {
      speak();
    }
  }, [name]);

  return { playSound };
}
