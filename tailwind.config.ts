import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    screens: {
        xs: "480px",
      },
      extend: {
      fontSize: {
        label: ["0.6875rem", { lineHeight: "1rem" }], // 11px — badges, counters
        caption: ["0.75rem", { lineHeight: "1rem" }], // 12px — metadata, timestamps
        "body-sm": ["0.8125rem", { lineHeight: "1.25rem" }], // 13px — secondary text
        body: ["0.875rem", { lineHeight: "1.375rem" }], // 14px — default body
        "body-lg": ["0.9375rem", { lineHeight: "1.5rem" }], // 15px — emphasized body
        "heading-sm": ["1rem", { lineHeight: "1.5rem" }], // 16px — section titles
        heading: ["1.125rem", { lineHeight: "1.75rem" }], // 18px — page titles
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-display)", '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ["var(--font-body)", '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        numeric: ["var(--font-numeric)", '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "14px",
        lg: "24px",
        xl: "40px",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.04) inset",
        "glass-lg": "0 8px 40px rgba(0,0,0,.6),  0 1px 0 rgba(255,255,255,.06) inset",
        "glow-teal": "0 0 20px rgba(13,205,165,.2), 0 0 40px rgba(13,205,165,.08)",
      },
      colors: {
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
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        "sidebar-bg": "hsl(var(--sidebar-bg))",
        "sidebar-fg": "hsl(var(--sidebar-fg))",
        "sidebar-fg-bright": "hsl(var(--sidebar-fg-bright))",
        "sidebar-hover": "hsl(var(--sidebar-hover))",
        "sidebar-active": "hsl(var(--sidebar-active))",
        "sidebar-active-fg": "hsl(var(--sidebar-active-fg))",
        "sidebar-border-color": "hsl(var(--sidebar-border))",
        "priority-urgent": "hsl(var(--priority-urgent))",
        "priority-high": "hsl(var(--priority-high))",
        "priority-normal": "hsl(var(--priority-normal))",
        "priority-low": "hsl(var(--priority-low))",
        "status-todo": "hsl(var(--status-todo))",
        "status-progress": "hsl(var(--status-progress))",
        "status-review": "hsl(var(--status-review))",
        "status-done": "hsl(var(--status-done))",
        "status-blocked": "hsl(var(--status-blocked))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-out-right": { from: { transform: "translateX(0)" }, to: { transform: "translateX(100%)" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.28s ease-out",
        "slide-out-right": "slide-out-right 0.28s ease-out forwards",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
