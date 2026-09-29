import { motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';
import './AppShell.css';

/** Top-level layout: sticky header, routed page content, bottom nav. */
export function AppShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main className="app-shell__content" id="main-content">
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomNavigation />
    </div>
  );
}
