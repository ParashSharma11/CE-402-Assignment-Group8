import { lazy, Suspense, useCallback, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Footer, Grain, Loader, Nav, SmoothScroll } from './components/layout';
import Landing from './pages/Landing';
import ShaderBackdrop from './components/ShaderBackdrop';

const Data = lazy(() => import('./pages/Data'));
const Ground = lazy(() => import('./pages/Ground'));
const Calculations = lazy(() => import('./pages/Calculations'));
const Design = lazy(() => import('./pages/Design'));
const Summary = lazy(() => import('./pages/Summary'));
const Styleguide = lazy(() => import('./pages/Styleguide'));

const seen = () => { try { return sessionStorage.getItem('gf-loader') === '1'; } catch { return false; } };

export default function App() {
  const loc = useLocation();
  const [loading, setLoading] = useState(() => !seen());
  const done = useCallback(() => { try { sessionStorage.setItem('gf-loader', '1'); } catch { /* private mode */ } setLoading(false); }, []);
  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" onDone={done} />}</AnimatePresence>
      <SmoothScroll />
      {loc.pathname !== '/' && (
        <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10">
          <ShaderBackdrop tone={0.6} scale={0.4} className="opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-ground/30 via-transparent to-ground/60" />
        </div>
      )}
      <Grain />
      <Nav />
      <Suspense fallback={<div className="hud grid min-h-[60vh] place-items-center">loading…</div>}>
        <AnimatePresence mode="wait">
          <Routes location={loc} key={loc.pathname}>
            <Route path="/" element={<Landing ready={!loading} />} />
            <Route path="/data" element={<Data />} />
            <Route path="/ground" element={<Ground />} />
            <Route path="/calculations" element={<Calculations />} />
            <Route path="/design" element={<Design />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/styleguide" element={<Styleguide />} />
            <Route path="*" element={<Landing ready={!loading} />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <Footer />
    </>
  );
}
