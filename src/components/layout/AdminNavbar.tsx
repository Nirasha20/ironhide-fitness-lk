import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const items = [
  { to: '/admin', label: 'Dashboard' },
];

export function AdminNavbar() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      navigate('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-surface-container-highest bg-surface/95 backdrop-blur-md">
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
          onClick={handleSignOut}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full border border-border-default bg-surface-container px-5 py-3 text-body-md font-display uppercase tracking-[0.15em] text-on-surface transition hover:border-primary-container hover:text-primary-container disabled:opacity-50"
        >
          {busy ? 'Signing out...' : 'Logout'}
        </button>
      </div>
    </header>
  );
}
