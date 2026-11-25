import { lazy, Suspense, useCallback, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Footer, Grain, Loader, Nav, SmoothScroll } from './components/layout';
import Landing from './pages/Landing';

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
