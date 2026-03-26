/**
 * @file sidebar.test.tsx
 *
 * Component tests for the dark Sidebar — implementation-plan.md §6.4.5.
 *
 * Acceptance criteria covered:
 * - Dark sidebar renders with brand-800 background and nav items (AC #5)
 *
 * These tests run in a real browser environment via Vitest Browser Mode so
 * that computed styles are accurate.
 */

import React from 'react';
import { render } from 'vitest-browser-react';
import { describe, test, expect } from 'vitest';
import { Settings, Check } from 'lucide-react';
import { Sidebar } from '../../src/components/Sidebar';

describe('Sidebar', () => {
  test('renders with data-testid="dark-sidebar" and bg-brand-800 class', async () => {
    const screen = render(<Sidebar />);

    const sidebar = screen.getByTestId('dark-sidebar');
    await expect.element(sidebar).toBeInTheDocument();

    // Verify the Tailwind class that maps to brand-800 background is present
    await expect.element(sidebar).toHaveClass('bg-brand-800');
  });

  test('renders Tea Tax wordmark inside the sidebar', async () => {
    const screen = render(<Sidebar />);

    await expect.element(screen.getByText('Tea Tax')).toBeInTheDocument();
  });

  test('renders the accent-500 logo mark square', async () => {
    const screen = render(<Sidebar />);

    const logoMark = screen.getByTestId('sidebar-logo-mark');
    await expect.element(logoMark).toBeInTheDocument();
    await expect.element(logoMark).toHaveClass('bg-accent-500');
  });

  test('renders provided nav items as buttons', async () => {
    const navItems = [
      { id: 'upload', label: 'Upload', icon: <span>↑</span> },
      { id: 'results', label: 'Results', icon: <Check size={16} /> },
    ];

    const screen = render(<Sidebar navItems={navItems} />);

    await expect.element(screen.getByRole('button', { name: /Upload/ })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: /Results/ })).toBeInTheDocument();
  });

  test('active nav item receives bg-brand-900 class', async () => {
    const navItems = [
      { id: 'upload', label: 'Upload', icon: <Settings size={16} /> },
      { id: 'results', label: 'Results', icon: <Check size={16} /> },
    ];

    const screen = render(<Sidebar navItems={navItems} activeItemId="upload" />);

    const uploadBtn = screen.getByRole('button', { name: /Upload/ });
    await expect.element(uploadBtn).toHaveClass('bg-brand-900');

    const resultsBtn = screen.getByRole('button', { name: /Results/ });
    await expect.element(resultsBtn).not.toHaveClass('bg-brand-900');
  });

  test('renders username in the bottom user area', async () => {
    const screen = render(<Sidebar username="alice@example.com" />);

    await expect.element(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  test('renders a logout button when onLogout is provided', async () => {
    const screen = render(<Sidebar onLogout={() => {}} />);

    await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});
