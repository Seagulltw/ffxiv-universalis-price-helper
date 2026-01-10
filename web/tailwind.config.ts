import type { Config } from 'tailwindcss';

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      boxShadow: {
        card: '0 14px 30px rgba(30, 41, 59, 0.12)'
      }
    }
  },
  plugins: []
};

export default config;
