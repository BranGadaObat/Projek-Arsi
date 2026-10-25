/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
        canvas: "#F7F8FB",
        surface: "#FFFFFF",
        "surface-2": "#F1F3F9",
        line: "#E3E6EF",
        "line-strong": "#A7AEC0",
        ink: {
          DEFAULT: "#141A2C",
          2: "#4A5468",
          3: "#667085",
        },
        success: { DEFAULT: "#15803D", bg: "#DCFCE7" },
        warning: { DEFAULT: "#B45309", bg: "#FEF3C7" },
        danger: { DEFAULT: "#B42318", bg: "#FEE4E2" },
        info: { DEFAULT: "#1D4ED8", bg: "#DBEAFE" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(20, 26, 44, 0.06), 0 1px 3px rgba(20, 26, 44, 0.08)",
        md: "0 4px 12px rgba(20, 26, 44, 0.08)",
        lg: "0 16px 40px rgba(20, 26, 44, 0.14)",
      },
      fontSize: {
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};
