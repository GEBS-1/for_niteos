import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        niteos: {
          bg: "#0a0e17",
          surface: "#111827",
          card: "#1a2332",
          border: "#2a3a52",
          electric: "#00d4ff",
          "electric-dim": "#0099cc",
          glow: "#0066ff",
          muted: "#8b9cb3",
          text: "#e8edf5",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 212, 255, 0.25)",
        "glow-lg": "0 0 40px rgba(0, 102, 255, 0.35)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
