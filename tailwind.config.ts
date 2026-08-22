import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--cor-paper) / <alpha-value>)",
        card: "rgb(var(--cor-card) / <alpha-value>)",
        ink: "rgb(var(--cor-ink) / <alpha-value>)",
        pitch: {
          DEFAULT: "rgb(var(--cor-pitch) / <alpha-value>)",
          dark: "rgb(var(--cor-pitch-dark) / <alpha-value>)",
          line: "rgb(var(--cor-pitch-line) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--cor-brand) / <alpha-value>)",
          dark: "rgb(var(--cor-brand-dark) / <alpha-value>)",
        },
        gold: "rgb(var(--cor-gold) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 2px 0 0 rgba(0,0,0,0.08), 0 8px 20px -8px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
