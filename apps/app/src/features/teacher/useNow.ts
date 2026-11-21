import { useEffect, useState } from 'react';

export type NowFn = () => Date;

const defaultNow: NowFn = () => new Date();

export function useNow(now: NowFn = defaultNow, intervalMs = 30_000): Date {
  const [value, setValue] = useState(now);
  useEffect(() => {
    setValue(now());
    const id = setInterval(() => setValue(now()), intervalMs);
    return () => clearInterval(id);
  }, [now, intervalMs]);
  return value;
}
