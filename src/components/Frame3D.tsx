import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { Borehole } from '../engine';
import type { ColumnResult } from '../lib/results';
import { soilColor } from './viz';

const lerpColor = (t: number) => {
  // green (pass) → amber → red with settlement ratio t ∈ [0, 1.5]
  const k = Math.max(0, Math.min(1, t / 1.5));
  const a = [143, 212, 138], b = [255, 194, 71], c = [255, 107, 107];
  const [p, q, s] = k < 0.5 ? [a, b, k * 2] : [b, c, (k - 0.5) * 2];
  return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * s)).join(',')})`;
};

export default function Frame3D({ results, boreholes, nLines, nRows, sx, sy, sLimit, selected, onSelect, showSoil, bySettlement }: {
  results: ColumnResult[]; boreholes: Borehole[]; nLines: number; nRows: number; sx: number; sy: number; sLimit: number;
  selected?: string; onSelect: (id: string) => void; showSoil: boolean; bySettlement: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const Lx = (nLines - 1) * sx, Ly = (nRows - 1) * sy, storey = 3.2, floors = 4;
  const ox = Lx / 2, oy = Ly / 2;
  const beams = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number; h: number }[] = [];
    for (let f = 1; f <= floors; f++) {
      for (let r = 0; r < nRows; r++) out.push({ x: Lx / 2 - ox, z: r * sy - oy, len: Lx, rot: 0, h: f * storey });
      for (let l = 0; l < nLines; l++) out.push({ x: l * sx - ox, z: Ly / 2 - oy, len: Ly, rot: Math.PI / 2, h: f * storey });
    }
    return out;
  }, [Lx, Ly, nLines, nRows, sx, sy, ox, oy]);
  const zones = useMemo(() => {
    // one soil block per borehole zone (columns grouped by borehole)
    const m = new Map<string, number[]>();
    results.forEach((r) => { const a = m.get(r.col.boreholeId) ?? []; a.push(r.col.x); m.set(r.col.boreholeId, a); });
    return [...m.entries()].map(([id, xs]) => ({ bh: boreholes.find((b) => b.id === id), x0: Math.min(...xs) - sx / 2, x1: Math.max(...xs) + sx / 2 }));
  }, [results, boreholes, sx]);
  return (
    <Canvas camera={{ position: [Lx * 0.9, 22, Ly * 2.2], fov: 38 }} dpr={[1, 1.75]} style={{ height: 520, borderRadius: 20, background: '#0e0504' }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 40, 25]} intensity={1.1} />
      <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI * 0.62} />
      <gridHelper args={[80, 40, '#4a3a34', '#2e1e19']} position={[0, 0.001, 0]} />
      {/* ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[Lx + 16, Ly + 16]} /><meshStandardMaterial color="#1c0d0a" transparent opacity={showSoil ? 0.35 : 0.9} /></mesh>
      {/* soil layers */}
      {showSoil && zones.map((z) => z.bh && z.bh.layers.map((l, i) => (
        <mesh key={z.bh!.id + i} position={[(z.x0 + z.x1) / 2 - ox, -(l.top + l.bottom) / 2, 0]}>
          <boxGeometry args={[Math.max(0.1, z.x1 - z.x0 - 0.05), Math.max(0.05, l.bottom - l.top), Ly + 8]} />
          <meshStandardMaterial color={soilColor(l.symbol)} transparent opacity={0.55} />
        </mesh>
      )))}
      {/* beams */}
      {beams.map((b, i) => (
        <mesh key={i} position={[b.x, b.h, b.z]} rotation={[0, b.rot, 0]}><boxGeometry args={[b.len, 0.45, 0.3]} /><meshStandardMaterial color="#a88a80" transparent opacity={0.55} /></mesh>
      ))}
      {/* columns + footings */}
      {results.map((r) => {
        const f = r.check?.footing; const B = f?.B ?? 1, L = f?.L ?? B;
        const x = r.col.x - ox, z = oy - r.col.y;
        const s = (r.check?.sTotal ?? 0) * 1000;
        const sel = selected === r.col.id, hov = hover === r.col.id;
        const color = bySettlement ? lerpColor(s / sLimit) : r.found ? '#8fd48a' : '#ff6b6b';
        return (
          <group key={r.col.id} onPointerOver={(e) => { e.stopPropagation(); setHover(r.col.id); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHover(null); document.body.style.cursor = ''; }} onClick={(e) => { e.stopPropagation(); onSelect(r.col.id); }}>
            <mesh position={[x, storey * floors / 2, z]}><boxGeometry args={[0.4, storey * floors, 0.4]} /><meshStandardMaterial color={sel || hov ? '#ff4a1c' : '#f4e8df'} /></mesh>
            <mesh position={[x, -(r.check?.footing.Df ?? 1.5) + 0.25, z]}><boxGeometry args={[B, 0.5, L]} /><meshStandardMaterial color={color} emissive={sel || hov ? '#ff4a1c' : '#000'} emissiveIntensity={sel ? 0.6 : hov ? 0.35 : 0} /></mesh>
            {(hov || sel) && (
              <Html position={[x, storey * floors + 1.2, z]} center distanceFactor={30}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F4E8DF', background: '#140806', border: '1px solid #FF4A1C', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  {r.col.id} · B {B.toFixed(2)} m · s {s.toFixed(1)} mm
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </Canvas>
  );
}
