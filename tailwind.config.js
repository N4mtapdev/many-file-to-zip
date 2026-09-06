/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10B981",
          deep: "#059669",
          dark: "#047857",
          light: "#D1FAE5",
        },
        accent: {
          purple: "#8B5CF6",
          purpleDark: "#7C3AED",
          amber: "#F59E0B",
          amberStrong: "#D97706",
        },
        ink: {
          dark: "#0F172A",
          medium: "#64748B",
        },
        surface: {
          white: "#FFFFFF",
          tint: "#F0FDF4",
          border: "#E5E7EB",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "12px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        card: "0px 3px 14px rgba(16, 185, 129, 0.07)",
        cardHover: "0px 4px 18px rgba(16, 185, 129, 0.12)",
        cta: "0px 4px 18px rgba(16, 185, 129, 0.18)",
        ctaHover: "0px 6px 24px rgba(16, 185, 129, 0.28)",
        elevated:
          "0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.1)",
        focus: "0px 0px 0px 3px rgba(16, 185, 129, 0.1)",
      },
    },
  },
  plugins: [],
};
