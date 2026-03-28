import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      typography: {
        DEFAULT: {
          css: {
            h2: {
              fontSize: '1.5rem',
              fontWeight: '700',
              marginTop: '2.5rem',
              marginBottom: '1rem',
              lineHeight: '1.3',
              color: '#0f172a',
            },
            h3: {
              fontSize: '1.2rem',
              fontWeight: '600',
              marginTop: '2rem',
              marginBottom: '0.75rem',
              lineHeight: '1.4',
              color: '#1e293b',
            },
            h4: {
              fontSize: '1rem',
              fontWeight: '600',
              marginTop: '1.5rem',
              marginBottom: '0.5rem',
              color: '#334155',
            },
            p: {
              marginTop: '1rem',
              marginBottom: '1rem',
              lineHeight: '1.8',
            },
            li: {
              marginTop: '0.4rem',
              marginBottom: '0.4rem',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config