'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calculator,
  Dumbbell,
  Utensils,
  ClipboardList,
  Heart,
  Download,
  ChevronLeft,
  ChevronRight,
  MessageSquareWarning,
  ShieldCheck,
  CalendarCheck,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useSidebar } from '@/lib/sidebar-context';
import { useBackHandler } from '@/lib/back-handler';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calculator', label: 'Essentials', icon: Calculator },
  { href: '/exercise-plan', label: 'Exercises', icon: Dumbbell },
  { href: '/meal-plan', label: 'Meal', icon: Utensils },
  { href: '/logger', label: 'Health Logger', icon: ClipboardList },
  { href: '/habits', label: 'Habits & To-Do', icon: CalendarCheck },
  { href: '/health-assistant', label: 'Health', icon: Heart },
  { href: '/export-reports', label: 'Download', icon: Download },
  { href: '/report-problem', label: 'Report a Problem', icon: MessageSquareWarning },
  { href: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useStore();
  const { collapsed, mobileOpen, toggle, setMobileOpen } = useSidebar();

  useBackHandler(mobileOpen, () => setMobileOpen(false));

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen bg-surface-container-lowest border-r border-outline-variant/30 transition-all duration-300 z-40 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Gym at Home" className="w-8 h-8 rounded-lg object-cover" />
            {!collapsed && (
              <span className="text-lg font-bold text-on-surface">Gym at Home</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 pb-24 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Profile — lives at the bottom with the user's name, not in the nav */}
        <Link
          href="/profile"
          onClick={handleNavClick}
          title={collapsed ? profile?.name || 'Profile' : undefined}
          className={`absolute bottom-0 left-0 right-0 flex items-center gap-2 p-3 border-t border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container transition-colors ${
            collapsed ? 'justify-center' : ''
          } ${pathname === '/profile' ? 'text-primary' : 'text-on-surface'}`}
        >
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-primary">
                {(profile?.name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{profile?.name || 'User'}</p>
                <p className="text-[11px] text-on-surface-variant">View profile</p>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </>
          )}
        </Link>

        {/* Collapse Toggle - Right Edge (desktop only) */}
        <button
          onClick={toggle}
          className="hidden lg:flex absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 w-6 h-12 bg-surface-container-lowest border border-outline-variant/30 rounded-l-lg items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all z-50 shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </>
  );
}
