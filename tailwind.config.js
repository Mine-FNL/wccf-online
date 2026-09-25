/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* WCCF design tokens (design.md §2) */
        base: "#0B0E14",
        panel: "#12161F",
        raised: "#171C28",
        inset: "#080A0F",
        line: { DEFAULT: "#232A38", strong: "#323B4E" },
        wccf: {
          accent: "#FF8A1E",
          "accent-hover": "#FFA54D",
          gold: "#E8B84B",
          live: "#3DD68C",
          pitch: "#1E7A4C",
          danger: "#FF4D4F",
          caution: "#FFC531",
          ink: "#E8ECF4",
          dim: "#8A94A7",
          mute: "#5C6678",
        },
        /* shadcn variable-driven colors (dark values set in index.css) */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#FF8A1E",
          hover: "#FFA54D",
          dim: "rgba(255,138,30,0.12)",
          foreground: "#0B0E14",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        panel: "10px",
        card: "8px",
        btn: "6px",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        modal: "0 8px 24px rgba(0,0,0,0.45)",
        "accent-glow":
          "0 0 0 1px rgba(255,138,30,0.4), 0 0 24px rgba(255,138,30,0.15)",
      },
      maxWidth: {
        shell: "1440px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
        "pulse-halo": {
          "0%": { opacity: "0.6", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(2.2)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "ken-burns": {
          from: { transform: "scale(1)" },
          to: { transform: "scale(1.06)" },
        },
        "kira-shine": {
          from: { backgroundPosition: "-150% 0" },
          to: { backgroundPosition: "150% 0" },
        },
        "loading-bar": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(400%)" },
        },
        "edge-flash": {
          "0%": { boxShadow: "inset 0 0 0 2px rgba(255,138,30,0.9)" },
          "100%": { boxShadow: "inset 0 0 0 2px rgba(255,138,30,0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "pulse-halo": "pulse-halo 2s ease-out infinite",
        marquee: "marquee 40s linear infinite",
        "ken-burns": "ken-burns 20s ease-in-out infinite alternate",
        "kira-shine": "kira-shine 2.8s linear infinite",
        "loading-bar": "loading-bar 1.2s ease-in-out infinite",
        "edge-flash": "edge-flash 0.4s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
