import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export const isVoiceDictationSupported = !!SpeechRecognitionAPI;

export function useVoiceDictation(onTranscript: (text: string) => void, lang = 'fr-FR') {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const callbackRef = useRef(onTranscript);

  useEffect(() => { callbackRef.current = onTranscript; }, [onTranscript]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          text += event.results[i][0].transcript;
        }
      }
      if (text) callbackRef.current(text);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') console.error('Voice dictation error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang]);

  const toggle = useCallback(() => {
    if (isListening) stop(); else start();
  }, [isListening, start, stop]);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return { isListening, isSupported: !!SpeechRecognitionAPI, toggle, stop };
}
