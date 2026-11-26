import { describe, it, expect } from 'vitest';
import { boreholesToCsv, csvToBoreholes, parseCsv } from '../src/lib/csv';
import { boreholes } from '../src/examples/mandi';
import { validateLayers } from '../src/engine';

describe('borehole CSV import/export', () => {
  it('round-trips the Mandi boreholes exactly', () => {
    const { boreholes: back, errors } = csvToBoreholes(boreholesToCsv(boreholes));
    expect(errors).toEqual([]);
    expect(back.map((b) => b.id)).toEqual(boreholes.map((b) => b.id));
    back.forEach((b, i) => {
      expect(validateLayers(b.layers)).toEqual([]);
      expect(b.designWT).toBe(boreholes[i].designWT);
      expect(b.layers.length).toBe(boreholes[i].layers.length);
      expect(b.layers[1].phi).toBeCloseTo(boreholes[i].layers[1].phi!, 9);
      expect(b.spt.length).toBe(boreholes[i].spt.length);
    });
  });
  it('reads semicolon-separated files with decimal commas (Excel, European locale)', () => {
    const csv = 'record;borehole;measured_WT_m_bgl;design_WT_m_bgl;top_m;bottom_m;symbol;behaviour;gamma_sat_kN_m3;phi_deg;depth_m;N\n' +
      'borehole;BH-9;2,5;1,5;;;;;;;;\nlayer;BH-9;;;0;4;SP;granular;20;32,5;;\nspt;BH-9;;;;;;;;;1,5;12\n';
    const { boreholes: b, errors } = csvToBoreholes(csv);
    expect(errors).toEqual([]);
    expect(b[0].designWT).toBe(1.5);
    expect(b[0].layers[0].phi).toBe(32.5);
    expect(b[0].spt[0].N).toBe(12);
  });
  it('reports row-numbered errors instead of crashing', () => {
    const { errors } = csvToBoreholes('record,borehole,top_m,bottom_m,gamma_sat_kN_m3\nlayer,BH-1,0,abc,20\n');
    expect(errors.some((e) => /Row 2/.test(e))).toBe(true);
  });
  it('handles quoted cells with commas', () => {
    expect(parseCsv('a,b\n"x, y",2\n')).toEqual([['a', 'b'], ['x, y', '2']]);
  });
});
