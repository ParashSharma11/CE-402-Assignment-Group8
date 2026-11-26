/**
 * A calculation step as shown on a "step card":
 * equation → substituted numbers → result (with unit) → code-clause / textbook chip.
 */
export interface Step {
  /** Short title, e.g. "Bearing capacity factor Nq". */
  title: string;
  /** Symbolic equation, plain text, e.g. "Nq = e^(π tanφ) · tan²(45° + φ/2)". */
  equation: string;
  /** Equation with the numbers put in, e.g. "Nq = e^(π · tan 30°) · tan²(60°)". */
  substituted: string;
  /** Numeric result. */
  value: number;
  /** SI unit of the result ('' for dimensionless). */
  unit: string;
  /** Code clause or textbook reference (same text as the SOURCE comment in the code). */
  source: string;
  /** Optional note (assumption, warning). */
  note?: string;
}

export const step = (s: Step): Step => s;

/** Format a number for a substituted-equation string (3 significant decimals, trims zeros). */
export const n = (x: number, dp = 3): string => {
  if (!Number.isFinite(x)) return String(x);
  const s = x.toFixed(dp);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};
