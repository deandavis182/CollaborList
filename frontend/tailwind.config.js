/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:     'var(--color-primary)',
        accent:      'var(--color-accent)',
        bg:          'var(--color-bg)',
        surface:     'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        text:        'var(--color-text)',
        'text-muted':'var(--color-text-muted)',
        border:      'var(--color-border)',
        success:     'var(--color-success)',
        warning:     'var(--color-warning)',
        danger:      'var(--color-danger)',
        tabbar:      'var(--color-tabbar)',
        scrim:       'var(--color-scrim)',
      },
      borderRadius: {
        sm:    'var(--radius-sm)',
        md:    'var(--radius-md)',
        lg:    'var(--radius-lg)',
        xl:    '14px',
        lg2:   '16px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },
      fontFamily: {
        display: 'var(--font-display)',
      },
      backgroundImage: {
        'brand-gradient': 'var(--gradient-brand)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fontSize: {
        xs:   'var(--text-xs)',
        sm:   'var(--text-sm)',
        base: 'var(--text-base)',
        lg:   'var(--text-lg)',
        xl:   'var(--text-xl)',
        '2xl':'var(--text-2xl)',
      },
    },
  },
  plugins: [],
}