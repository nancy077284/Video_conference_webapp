import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Data-fetching helper that handles loading / error states and guards against
 * state updates after unmount. Re-runs when `reload()` is called.
 */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
  }, [immediate, run, version, ...deps]);

  return { data, loading, error, reload: () => setVersion((v) => v + 1), setData, run };
}

export default useAsync;
