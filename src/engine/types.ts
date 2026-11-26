/**
 * Engine data types. Units are fixed by field name / doc comment and are always SI:
 * depths m (positive downward from existing ground level), stresses kPa, unit weights kN/m³,
 * moduli kPa, cv m²/year, angles degrees.
 */

/** Broad behaviour class used to pick methods (Schmertmann for granular, consolidation for clay). */
export type SoilBehaviour = 'granular' | 'cohesive' | 'fill' | 'rock';

export interface SoilLayer {
  /** Top of layer, m below ground level. */
  top: number;
  /** Bottom of layer, m below ground level. */
  bottom: number;
  /** IS 1498 group symbol or label, e.g. 'SM', 'CI', 'GW', 'FILL'. */
  symbol: string;
  description?: string;
  behaviour: SoilBehaviour;
  /** Moist (bulk) unit weight above the water table, kN/m³. If absent, gammaSat is used. */
  gammaMoist?: number;
  /** Saturated unit weight below the water table, kN/m³. */
  gammaSat: number;
  /** Effective cohesion c′, kPa (drained). */
  c?: number;
  /** Effective friction angle φ′, degrees (drained). */
  phi?: number;
  /** Undrained shear strength cu, kPa. */
  cu?: number;
  /** Young's modulus for Schmertmann, kPa. */
  E?: number;
  /** Compression index Cc (–). */
  Cc?: number;
  /** Recompression / swelling index Cr (–). */
  Cr?: number;
  /** Initial void ratio e0 (–). */
  e0?: number;
  /** Preconsolidation pressure σ′p, kPa. If absent the clay is treated as normally consolidated (σ′p = σ′v0). */
  sigmaP?: number;
  /** Coefficient of consolidation cv, m²/year. */
  cv?: number;
  /** IS 2131 dilatancy correction applies (very fine / silty sand below the WT). */
  dilatancy?: boolean;
  /** Fines content (passing 75 µm), % — used for the liquefaction fines correction. */
  fines?: number;
  /** Plasticity index, % — used to screen clays for liquefaction susceptibility. */
  PI?: number;
}

export interface SptRecord {
  /** Test depth, m bgl. */
  depth: number;
  /** Field blow count N (blows / 300 mm). Use 100 for refusal. */
  N: number;
  refusal?: boolean;
  note?: string;
}

export interface Borehole {
  id: string;
  /** Ground level, m RL. */
  groundRL: number;
  layers: SoilLayer[];
  spt: SptRecord[];
  /** Water table measured 24 h after boring, m bgl. This is the WT at the time of the SPT and of sampling, so
   *  it is used for the IS 2131 corrections, the liquefaction (N1)60 and σ′v0 / OCR in the consolidation analysis. */
  measuredWT: number;
  /** Design (seasonal highest) water table, m bgl. */
  designWT: number;
  /** Seasonal lowest WT, m bgl (information only). */
  lowestWT?: number;
  /** Plan position of the borehole, m (x along length, y across width). */
  x?: number;
  y?: number;
}

export type FootingShape = 'strip' | 'square' | 'rectangle' | 'circle';

export interface Footing {
  shape: FootingShape;
  /** Width (or diameter for a circle), m. */
  B: number;
  /** Length, m (ignored for strip / square / circle). */
  L?: number;
  /** Founding depth below ground, m. */
  Df: number;
}

export interface Load {
  /** Vertical column load at founding level, kN (strip: kN/m). */
  P: number;
  /** Moment about the axis parallel to L (causes eccentricity along B), kN·m. */
  MB?: number;
  /** Moment about the axis parallel to B (causes eccentricity along L), kN·m. */
  ML?: number;
  /** Load inclination to the vertical, degrees. */
  alpha?: number;
}
