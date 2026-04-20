// ============================================================================
// tailwind.config.js
// ============================================================================
// Tailwind is a utility-first CSS framework. Instead of writing CSS files,
// you put style classes directly on elements: <div className="p-4 bg-white" />
//
// The `theme.extend` section below adds our SimuCast brand orange palette.
// After this, you can use classes like `bg-brand-600`, `text-brand-800`, etc.
// ============================================================================

/** @type {import('tailwindcss').Config} */
export default {
  // Which files Tailwind scans for class names
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Our orange brand palette ---
        // Tailwind color scales go from 50 (lightest) to 900 (darkest).
        // These values come from Tailwind's built-in `orange` palette,
        // which we chose for SimuCast's accent color.
        brand: {
          50:  "#FFF7ED",   // very light — subtle backgrounds
          100: "#FFEDD5",   // AI chat bubble background
          200: "#FED7AA",   // histogram lightest bar
          300: "#FDBA74",   // border on AI cards
          400: "#FB923C",   // mid-tone bars
          500: "#F97316",   // standard orange
          600: "#EA580C",   // PRIMARY — buttons, logo, active states
          700: "#C2410C",   // hover/pressed
          800: "#9A3412",   // text on light orange backgrounds
          900: "#7C2D12",   // darkest
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
}
