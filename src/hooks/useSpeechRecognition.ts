/**
 * useSpeechRecognition — Web Speech API hook
 * ────────────────────────────────────────────
 * Supports Malayalam (ml-IN) and English (en-IN) recognition.
 * Gracefully degrades when Web Speech API is unavailable.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Locale } from '@/types';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

const LOCALE_MAP: Record<Locale, string> = {
  en: 'en-IN',
  ml: 'ml-IN',
};

export function useSpeechRecognition(locale: Locale): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LOCALE_MAP[locale];

      recognition.onresult = (event: { results: Iterable<{ transcript: string }[]> }) => {
        const results = Array.from(event.results);
        const text = results.map((r) => r[0].transcript).join('');
        setTranscript(text);
      };

      recognition.onerror = (event: { error: string }) => {
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [locale]);

  // Update language when locale changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LOCALE_MAP[locale];
    }
  }, [locale]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError('Recognition already started');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
}
