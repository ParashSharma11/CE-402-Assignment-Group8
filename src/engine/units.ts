/**
 * Units and constants. The engine works internally in kN, kPa (kN/m²), m, kN/m³ and years.
 * Conversions for the units that appear on laboratory sheets live here and nowhere else.
 */

/** Unit weight of water, kN/m³. SOURCE: standard value g·ρw = 9.81 m/s² × 1.0 t/m³ (IS 1498 / textbooks). */
export const GAMMA_W = 9.81;

/** Standard gravity, m/s². SOURCE: CGPM 1901 standard value. */
export const G_STD = 9.80665;

/** kg/cm² → kPa. 1 kgf/cm² = 9.80665 N / 1e-4 m² = 98.0665 kPa. SOURCE: definition of kgf (CGPM). */
export const KG_PER_CM2_TO_KPA = 98.0665;

/** cm²/s → m²/year. 1 cm² = 1e-4 m²; 1 year (Julian) = 365.25 × 86 400 s = 31 557 600 s. SOURCE: SI definitions. */
export const CM2_PER_S_TO_M2_PER_YR = 1e-4 * 31_557_600;

export const kgcm2ToKPa = (p_kgcm2: number): number => p_kgcm2 * KG_PER_CM2_TO_KPA;
export const cm2sToM2yr = (cv_cm2s: number): number => cv_cm2s * CM2_PER_S_TO_M2_PER_YR;

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;
export const rad2deg = (rad: number): number => (rad * 180) / Math.PI;

/** Round for display only (never used inside calculations). */
export const fmt = (x: number, dp = 2): string =>
  Number.isFinite(x) ? x.toFixed(dp) : String(x);
