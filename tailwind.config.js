/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#05070a',
          900: '#0a0d14',
          850: '#0f141e',
          800: '#151b28',
          700: '#1e273a',
          600: '#2c3850',
        },
        cyan: {
          glow: '#00f2fe',
          neon: '#4facfe',
        },
        violet: {
          neon: '#a855f7',
          glow: '#c084fc',
        },
        hazard: {
          warning: '#f59e0b',
          danger: '#ff0055',
          glow: '#ff3366',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['"Orbitron"', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'seismic-ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'grid-scroll': 'gridScroll 20s linear infinite',
      },
      keyframes: {
        gridScroll: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        }
      }
    },
  },
  plugins: [],
}
