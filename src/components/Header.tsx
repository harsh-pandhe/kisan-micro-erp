import { OfflineStatus } from './OfflineStatus';
import './Header.css';

/** Top app bar: app name + connectivity status. Present on every page. */
export function Header() {
  return (
    <header className="app-header">
      <span className="app-header__brand">Kisan Micro-ERP</span>
      <OfflineStatus />
    </header>
  );
}
