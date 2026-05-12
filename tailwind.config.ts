import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // UI text
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Code / color values
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Proportional uppercase numerals — apply via .font-numeric utility
        numeric: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── Surface (Group-Type-Emphasis-State) ───────────────────────────────
        // Layout surfaces
        'surface-page':                       '#F9FAFB', // neutral-50  — app/page bg
        'surface-page-dark':                  '#0A0A0A', // neutral-950
        'surface-base':                       '#FFFFFF', // white       — cards, header, modals
        'surface-base-dark':                  '#171717', // neutral-900
        'surface-sunken':                     '#F5F5F5', // neutral-100 — sidebar, detail panels
        'surface-sunken-dark':                '#171717', // neutral-900 (border provides separation)
        'surface-control':                    '#FFFFFF', // white       — input fields, small controls
        'surface-control-dark':               '#262626', // neutral-800
        // Neutral interactive states
        'surface-neutral-subtle-hover':       '#F5F5F5', // neutral-100
        'surface-neutral-subtle-hover-dark':  '#262626', // neutral-800
        'surface-neutral-subtle-active':      '#E5E5E5', // neutral-200
        'surface-neutral-subtle-active-dark': '#404040', // neutral-700
        // Primary CTA (inverted: dark bg in light, white bg in dark)
        'surface-neutral-strong-rest':        '#171717', // neutral-900
        'surface-neutral-strong-rest-dark':   '#FFFFFF',
        'surface-neutral-strong-hover':       '#404040', // neutral-700
        'surface-neutral-strong-hover-dark':  '#E5E5E5', // neutral-200
        // Danger
        'surface-danger-subtle-rest':         '#FEF2F2', // red-50
        'surface-danger-subtle-rest-dark':    '#450A0A', // red-950

        // ── Foreground (Group-Emphasis) ───────────────────────────────────────
        'fg-base':             '#171717', // neutral-900 — primary text, headings
        'fg-base-dark':        '#FFFFFF',
        'fg-subtle':           '#404040', // neutral-700 — secondary text, secondary actions
        'fg-subtle-dark':      '#D4D4D4', // neutral-300
        'fg-muted':            '#737373', // neutral-500 — labels, icons, captions
        'fg-muted-dark':       '#A3A3A3', // neutral-400
        'fg-placeholder':      '#A3A3A3', // neutral-400 — empty states, timestamps
        'fg-placeholder-dark': '#737373', // neutral-500
        'fg-inverted':         '#FFFFFF', // white       — text on strong surface (CTA)
        'fg-inverted-dark':    '#171717', // neutral-900
        'fg-danger':           '#EF4444', // red-500     — destructive actions
        'fg-danger-dark':      '#F87171', // red-400

        // ── Border (bd- prefix avoids "border-border-" double prefix) ─────────
        'bd-base':         '#E5E5E5', // neutral-200 — default borders everywhere
        'bd-base-dark':    '#404040', // neutral-700
        'bd-hover':        '#D4D4D4', // neutral-300 — card hover, option hover
        'bd-hover-dark':   '#525252', // neutral-600
        'bd-strong':       '#A3A3A3', // neutral-400 — inline edit inputs, stronger dividers
        'bd-strong-dark':  '#737373', // neutral-500
        'bd-primary':      '#171717', // neutral-900 — selected/active state
        'bd-primary-dark': '#FFFFFF',
        'bd-danger':       '#FCA5A5', // red-300     — danger context
        'bd-danger-dark':  '#991B1B', // red-800
      },
    },
  },
  plugins: [],
} satisfies Config
