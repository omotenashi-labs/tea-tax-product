/**
 * @file Sidebar.tsx
 *
 * Dark sidebar component implementing the brand visual identity specified in
 * implementation-plan.md §6.4.2 and §6.4.5.
 *
 * Design decisions (§6.4.1):
 * - Background: bg-brand-800 (#243b53) — dark navy, not black
 * - Width: w-56 — wide enough for text labels (institutional feel)
 * - Nav items use text-brand-300 default / text-white bg-brand-900 active
 * - Logo: wordmark + accent-500 square mark (geometric, not a gradient)
 * - Bottom: user avatar + username in text-brand-300
 *
 * The dark sidebar is the single biggest visual change that establishes this
 * as a "serious tool" rather than a generic Tailwind starter template.
 */

import React from 'react';
import { Settings, LogOut } from 'lucide-react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface SidebarProps {
  /** Active nav item id. */
  activeItemId?: string;
  /** Nav items to render. */
  navItems?: SidebarNavItem[];
  /** Callback when a nav item is clicked. */
  onNavItemClick?: (id: string) => void;
  /** Display name for the logged-in user. */
  username?: string;
  /** Callback when the logout button is clicked. */
  onLogout?: () => void;
}

/**
 * Dark sidebar for the Tea Tax demo app.
 *
 * Implements §6.4.5 "Dark sidebar (replacing existing white sidebar)":
 * - bg-brand-800 background
 * - w-56 width with text labels
 * - accent-500 square mark logo
 * - brand-300/white/brand-900 nav item states
 */
export function Sidebar({
  activeItemId,
  navItems = [],
  onNavItemClick,
  username,
  onLogout,
}: SidebarProps) {
  return (
    <nav data-testid="dark-sidebar" className="w-56 shrink-0 bg-brand-800 flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-4 py-5 shrink-0">
        <div
          data-testid="sidebar-logo-mark"
          className="w-4 h-4 bg-accent-500 rounded-sm shrink-0"
        />
        <span className="text-white font-bold text-lg tracking-tight select-none">Tea Tax</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.id === activeItemId;
          return (
            <button
              key={item.id}
              onClick={() => onNavItemClick?.(item.id)}
              className={[
                'flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors text-left',
                isActive
                  ? 'text-white bg-brand-900'
                  : 'text-brand-300 hover:text-white hover:bg-brand-700/50',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Default settings item when no navItems provided */}
        {navItems.length === 0 && (
          <button
            onClick={() => onNavItemClick?.('settings')}
            className={[
              'flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors text-left',
              activeItemId === 'settings'
                ? 'text-white bg-brand-900'
                : 'text-brand-300 hover:text-white hover:bg-brand-700/50',
            ].join(' ')}
          >
            <span className="shrink-0">
              <Settings size={16} />
            </span>
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* Bottom user area */}
      <div className="shrink-0 px-3 py-4 border-t border-brand-700/50 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
          <span className="text-brand-300 text-xs font-semibold uppercase select-none">
            {username ? username.charAt(0) : '?'}
          </span>
        </div>
        <span className="flex-1 text-brand-300 text-xs truncate">{username ?? 'Guest'}</span>
        {onLogout && (
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="text-brand-400 hover:text-white transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </nav>
  );
}
