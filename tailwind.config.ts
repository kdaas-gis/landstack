import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        base: '#f8fafc',
        panel: '#ffffff',
        edge: '#e2e8f0',
        ink: '#0f172a',
        muted: '#64748b',
        // @ts-ignore: Tailwind functional color definition is valid but typing is sometimes mismatched
        accent: ({ opacityValue }: any) => {
          if (opacityValue) {
            return `color-mix(in srgb, var(--color-accent) calc(${opacityValue} * 100%), transparent)`;
          }
          return 'var(--color-accent)';
        }
      }
    }
  },
  plugins: []
};

export default config;
