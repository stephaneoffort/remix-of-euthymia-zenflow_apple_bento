import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceDictation() {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      if (!isSupported) return;
      onFinalRef.current = onFinal;

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };
      recognition.onerror = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          } else {
            interimTranscript += t;
          }
        }

        if (finalTranscript && onFinalRef.current) {
          onFinalRef.current(finalTranscript + ' ');
        }
        setInterimText(interimTranscript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { isListening, interimText, isSupported, start, stop };
}
