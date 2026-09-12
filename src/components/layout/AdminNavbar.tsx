import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const items = [
  { to: '/admin', label: 'Dashboard' },
  
  { to: '/admin/memberships', label: 'Memberships' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/cash-management', label: 'Cash Management' },
];

export function AdminNavbar() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-surface-container-highest bg-surface/95 backdrop-blur-md" ref={navRef}>
      <div className="max-w-container mx-auto flex items-center justify-between gap-4 px-margin-mobile py-4 md:px-margin-desktop">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary-container text-on-primary-container grid place-items-center font-bold uppercase">AD</div>
          <div>
            <p className="font-display text-headline-sm uppercase tracking-[0.18em] text-on-surface">IronHide Admin</p>
            <p className="text-label-sm text-on-surface-variant">Admin dashboard</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `text-body-md font-body transition-colors ${isActive ? 'text-primary-container font-semibold border-b-2 border-primary-container pb-1' : 'text-on-surface hover:text-primary-container'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          className="hidden md:inline-flex items-center justify-center rounded-full border border-border-default bg-surface-container px-5 py-3 text-body-md font-display uppercase tracking-[0.15em] text-on-surface transition hover:border-primary-container hover:text-primary-container disabled:opacity-50"
          onClick={handleSignOut}
          disabled={busy}
        >
          {busy ? 'Signing out...' : 'Logout'}
        </button>

        <button
          className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-full border border-surface-container-highest bg-surface-container text-on-surface transition hover:bg-surface-container-high"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="bg-surface border-t border-surface-container-highest px-margin-mobile py-4 flex flex-col gap-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={closeMenu}
              className={({ isActive }) =>
                `text-body-md font-body transition-colors ${isActive ? 'text-primary-container font-semibold' : 'text-on-surface hover:text-primary-container'}`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <button
            onClick={() => {
              handleSignOut();
              closeMenu();
            }}
            disabled={busy}
            className="text-left text-body-md font-body text-on-surface hover:text-primary-container"
          >
            {busy ? 'Signing out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  );
}
