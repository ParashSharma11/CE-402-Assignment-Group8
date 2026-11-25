import { useEffect, useRef } from 'react';

/**
 * A live, endless "video" drawn on the GPU: warped soil strata with contour lines that drift
 * slowly and bend toward the cursor. No video file, so nothing to download; pauses when off-screen
 * or in a background tab; renders one still frame under prefers-reduced-motion; falls back to
 * nothing if WebGL is unavailable.
 */
const FRAG = `
precision mediump float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float tone;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r.y;
  vec2 mc=m*vec2(r.x/r.y,1.);
  float md=exp(-6.*distance(uv,mc));
  vec2 q=vec2(fbm(uv*1.1+vec2(0.,t*.025)),fbm(uv*1.1+vec2(5.2,1.3)-t*.018));
  float f=fbm(uv*1.5+2.2*q+vec2(t*.012,0.)+md*.35);
  // strata: warped horizontal bands
  float s=uv.y*5.5+f*3.2;
  float band=floor(s);
  vec3 c0=vec3(.078,.031,.024), c1=vec3(.14,.075,.052), c2=vec3(.11,.06,.05), c3=vec3(.17,.11,.07);
  float k=fract(band*.37);
  vec3 base=k<.25?c0:k<.5?c1:k<.75?c2:c3;
  base=mix(base,c0,.35);
  // contour lines of the warped field (isolines)
  float iso=abs(fract(f*13.)-.5)*2.;
  float line=smoothstep(.90,1.,iso);
  float edge=smoothstep(.96,1.,abs(fract(s)-.5)*2.);
  vec3 col=base;
  col+=vec3(.96,.91,.87)*line*.045;
  col+=vec3(1.,.29,.11)*edge*(.10+.25*md)*tone;
  col+=vec3(1.,.29,.11)*md*.05*tone;
  vec2 v=gl_FragCoord.xy/r-.5; col*=1.-dot(v,v)*1.1;
  gl_FragColor=vec4(col,1.);
}`;
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

export default function ShaderBackdrop({ className = '', scale = 0.5, tone = 1 }: { className?: string; scale?: number; tone?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { cv.style.display = 'none'; return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.style.display = 'none'; return; }
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm'), uTone = gl.getUniformLocation(pr, 'tone');
    gl.uniform1f(uTone, tone);
    const mouse = { x: 0.7, y: 0.5, tx: 0.7, ty: 0.5 };
    const resize = () => {
      const w = Math.max(1, Math.floor(cv.clientWidth * scale)), h = Math.max(1, Math.floor(cv.clientHeight * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
    };
    const onMove = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); mouse.tx = (e.clientX - b.left) / b.width; mouse.ty = 1 - (e.clientY - b.top) / b.height; };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true, raf = 0; const t0 = performance.now();
    const draw = (now: number) => {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform1f(uT, reduce ? 12 : (now - t0) / 1000);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(draw); });
    io.observe(cv);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && visible) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); };
  }, [scale, tone]);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
