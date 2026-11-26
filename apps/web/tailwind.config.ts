import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#172d25',
        forest: '#184638',
        canvas: '#f8f8f2',
        mint: '#e7efe2',
        line: '#dce5dc',
        quiet: '#485b52'
      }
    }
  },
  plugins: []
};

export default config;
