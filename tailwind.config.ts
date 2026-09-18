import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta oficial do DESIGN.md
        "bg-primary": "#FFFFFF",
        "bg-secondary": "#F7F7F8",
        primary: "#E30613",
        "primary-hover": "#B8000C",
        "red-subtle": "#FFF4F4",
        "warn-bg": "#FFF8F8",
        "warn-border": "#F5CCCC",
        "text-primary": "#171717",
        "text-secondary": "#666666",
        "text-muted": "#8A8A8A",
        "border-subtle": "#E8E8E8",
        "border-input": "#DEDEDE",
        whatsapp: "#25D366",
        "whatsapp-hover": "#1EBE5A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "sans-serif"],
      },
      borderRadius: {
        input: "12px",
        btn: "12px",
        card: "16px",
        "card-lg": "20px",
        "card-xl": "24px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.04)",
        "card-elevated": "0 8px 32px rgba(0,0,0,0.08)",
        "card-primary": "0 8px 32px rgba(227,6,19,0.10)",
      },
      maxWidth: {
        wizard: "720px",
        compare: "1200px",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 220ms ease-out both",
        "fade-in": "fade-in 200ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
