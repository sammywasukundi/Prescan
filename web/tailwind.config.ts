import type { Config } from "tailwindcss";

// Les couleurs sont des variables CSS (canaux RGB) définies dans globals.css :
// le mode sombre redéfinit les jetons, il n'inverse pas le mode clair.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        fg: token("fg"),
        muted: token("muted"),
        primary: token("primary"),
        "primary-fg": token("primary-fg"),
        success: token("success"),
        danger: token("danger"),
        warn: token("warn"),
        border: token("border"),
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
