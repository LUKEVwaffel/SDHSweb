import { useState, useCallback } from 'react';

/** Raw-localStorage-backed state, following the get-or-init pattern in src/lib/fingerprint.js. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Kiosk browser storage full/disabled — value still updates in-memory for this session.
      }
      return resolved;
    });
  }, [key]);

  return [value, setStoredValue];
}
