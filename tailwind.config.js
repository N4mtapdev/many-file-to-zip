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
          DEFAULT: "#0F8A5F",
          deep: "#0A6E4A",
          dark: "#075539",
          light: "#DCEFE3",
        },
        accent: {
          purple: "#8B5CF6",
          purpleDark: "#7C3AED",
          amber: "#B8720E",
          amberStrong: "#8A5309",
        },
        ink: {
          dark: "#231F1A",
          medium: "#7A7267",
        },
        surface: {
          white: "#FFFFFF",
          tint: "#F5F1E8",
          border: "#E3DCC9",
          kraft: "#EFE9D8",
          folder: "#F7EFD9",
          folderTab: "#EDDFB0",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        xs: "3px",
        sm: "5px",
        md: "7px",
        lg: "8px",
        xl: "10px",
      },
      boxShadow: {
        card: "0px 2px 6px rgba(35, 31, 26, 0.08), 0px 1px 2px rgba(35, 31, 26, 0.06)",
        cardHover: "0px 6px 16px rgba(35, 31, 26, 0.14), 0px 2px 4px rgba(35, 31, 26, 0.08)",
        cta: "0px 3px 10px rgba(15, 138, 95, 0.28)",
        ctaHover: "0px 6px 18px rgba(15, 138, 95, 0.36)",
        elevated:
          "0px 12px 24px rgba(35, 31, 26, 0.16), 0px 4px 8px rgba(35, 31, 26, 0.1)",
        focus: "0px 0px 0px 3px rgba(15, 138, 95, 0.15)",
        tab: "0px -2px 4px rgba(35, 31, 26, 0.04)",
      },
    },
  },
  plugins: [],
};