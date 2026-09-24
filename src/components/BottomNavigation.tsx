import { NavLink } from 'react-router-dom';
import './BottomNavigation.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
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
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
