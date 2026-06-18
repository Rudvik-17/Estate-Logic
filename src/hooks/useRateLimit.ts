import { useRef, useState, useEffect } from 'react';
import { Alert } from 'react-native';

export function useRateLimit(limit: number = 7, windowMs: number = 60000) {
  const [isLimited, setIsLimited] = useState(false);
  const attemptsRef = useRef<number[]>([]);
  const timeoutRef = useRef<any>(null);

  const tryAction = (fn: () => void) => {
    const now = Date.now();
    attemptsRef.current = attemptsRef.current.filter(t => now - t < windowMs);

    if (attemptsRef.current.length >= limit) {
      Alert.alert('Too many attempts. Please wait a moment.');
      if (!isLimited) {
        setIsLimited(true);
      }
      
      const oldest = attemptsRef.current[0];
      const timeRemaining = oldest + windowMs - now;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsLimited(false);
      }, Math.max(0, timeRemaining));
      return;
    }

    attemptsRef.current.push(now);

    if (attemptsRef.current.length >= limit) {
      setIsLimited(true);
      const oldest = attemptsRef.current[0];
      const timeRemaining = oldest + windowMs - now;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsLimited(false);
      }, Math.max(0, timeRemaining));
    }

    fn();
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    isLimited,
    tryAction,
  };
}
