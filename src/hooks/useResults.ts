import { useEffect, useMemo, useState } from 'react';
import { useProject, type ProjectState } from '../store/project';
import { computeResults, type ProjectResults } from '../lib/results';

/** Returns `value` after it has stopped changing for `ms` milliseconds. */
export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Live results: recomputed ~200 ms after the last input change (no "Calculate" button). */
export function useResults(): ProjectResults {
  const s = useProject();
  const inputs = useMemo(() => ({ project: s.project, building: s.building, boreholes: s.boreholes, lab: s.lab }), [s.project, s.building, s.boreholes, s.lab]);
  const d = useDebounced(inputs, 200);
  return useMemo(() => computeResults({ ...s, ...d } as ProjectState), [d]); // eslint-disable-line react-hooks/exhaustive-deps
}
