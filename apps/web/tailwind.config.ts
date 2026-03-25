import { join } from 'path';

const dir = import.meta.dirname ?? __dirname;

/** @type {import('tailwindcss').Config} */
export default {
  content: [join(dir, 'index.html'), join(dir, 'src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      colors: {
        // Brand — deep navy, not generic indigo
        // Signals: trust, finance, institutional authority
        brand: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98', // Primary — muted, confident, not loud
          600: '#486581', // Primary hover
          700: '#334e68', // Primary pressed, active nav text
          800: '#243b53', // Dark sidebar background
          900: '#102a43', // Darkest — sidebar active state
        },
        // Accent — teal, used sparingly for CTAs and focus
        // Distinct from the generic indigo/blue every template uses
        accent: {
          400: '#4fd1c5',
          500: '#38b2ac', // CTA buttons, focus rings, active indicators
          600: '#319795', // CTA hover
          700: '#2c7a7b', // CTA pressed
        },
        // Semantic — validation and confidence
        signal: {
          success: '#38a169', // Green — high confidence, valid, free tier
          caution: '#d69e2e', // Amber — medium confidence, warnings
          error: '#e53e3e', // Red — low confidence, errors, critical
          info: '#3182ce', // Blue — informational
        },
        // Surface — cool slate grays instead of warm zinc
        surface: {
          50: '#f7fafc', // Page background
          100: '#edf2f7', // Card hover, subtle bg
          200: '#e2e8f0', // Borders, dividers
          300: '#cbd5e0', // Disabled borders
          400: '#a0aec0', // Muted text, placeholders
          500: '#718096', // Secondary text
          600: '#4a5568', // Body text
          700: '#2d3748', // Headings
          800: '#1a202c', // Primary text, high contrast
          900: '#171923', // Near-black
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        // Override defaults for tighter, more institutional feel
        sm: '2px', // Badges, pills, status dots
        DEFAULT: '4px', // Buttons, inputs, small elements
        md: '6px', // Cards, dropdowns
        lg: '8px', // Modals, upload zone, larger panels
        xl: '8px', // Alias — no bubbly 12px/16px radii
        full: '9999px', // Avatars, circular indicators only
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        card: '0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
