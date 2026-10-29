'use client';

import { ChevronDown, User, Sun, Moon, Menu } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store-context';
import { useSidebar } from '@/lib/sidebar-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();
  const { profile, theme, toggleTheme } = useStore();
  const { setMobileOpen } = useSidebar();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = profile?.name || 'User';

  return (
    <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-surface-container transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-on-surface-variant" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-headline-md font-semibold text-on-surface truncate">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-on-surface-variant truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg hover:bg-surface-container transition-colors"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5 text-on-surface-variant" />
          ) : (
            <Sun className="w-5 h-5 text-on-surface-variant" />
          )}
        </button>

        {/* User Profile Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-container transition-colors"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden shrink-0">
              {profile?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-primary">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-on-surface-variant hidden sm:block transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-elevated z-50 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/30">
                <p className="text-sm font-bold text-on-surface">{displayName}</p>
                <p className="text-xs text-on-surface-variant">Most data stays on this device</p>
              </div>
              <div className="py-2">
                <button
                  onClick={() => { setShowProfile(false); router.push('/profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low text-on-surface text-sm transition-colors"
                >
                  <User className="w-4 h-4 text-on-surface-variant" />
                  Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
