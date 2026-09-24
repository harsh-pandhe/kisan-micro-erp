import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';
import './AppShell.css';

/** Top-level layout: sticky header, routed page content, bottom nav. */
export function AppShell() {
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main className="app-shell__content" id="main-content">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}
