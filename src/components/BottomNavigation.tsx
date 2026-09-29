import {
  LayoutDashboard,
  ReceiptText,
  WalletCards,
  ChartNoAxesCombined,
  Settings,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import './BottomNavigation.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', Icon: ReceiptText },
  { to: '/accounts', label: 'Accounts', Icon: WalletCards },
  { to: '/reports', label: 'Reports', Icon: ChartNoAxesCombined },
  { to: '/settings', label: 'Settings', Icon: Settings },
] as const;

/** Mobile bottom tab bar. Also usable as top-level nav on larger screens. */
export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <ul className="bottom-nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}`
              }
            >
              <item.Icon className="bottom-nav__icon" size={22} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
