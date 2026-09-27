import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: "hsl(var(--sidebar))",
        "sidebar-fg": "hsl(var(--sidebar-fg))",
        "sidebar-muted": "hsl(var(--sidebar-muted))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        sm: "0 1px 2px hsl(220 16% 14% / 0.06)",
        md: "0 8px 24px hsl(220 16% 14% / 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2rem", { lineHeight: "2.5rem", fontWeight: "600" }],
        h1: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        h2: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        h3: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        body: ["1rem", { lineHeight: "1.5rem" }],
        small: ["0.875rem", { lineHeight: "1.25rem" }],
        caption: ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
export default config;
