/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s infinite',
      },
      borderRadius: {
        base: "5px",
      },
      boxShadow: {
        shadow: "4px 4px 0px 0px #000",
      },
      translate: {
        boxShadowX: "4px",
        boxShadowY: "4px",
        reverseBoxShadowX: "-4px",
        reverseBoxShadowY: "-4px",
      },
      fontWeight: {
        base: "500",
        heading: "700",
      },
      colors: {
        main: {
          DEFAULT: "#FFFF00",
          foreground: "#000",
        },
        background: {
          DEFAULT: "#FFF",
          dark: "#1A1A1A",
        },
        foreground: {
          DEFAULT: "#000",
          dark: "#FFF",
        },
        border: {
          DEFAULT: "#000",
          dark: "#FFF",
        },
        "secondary-background": {
          DEFAULT: "#EFEFEF",
          dark: "#2A2A2A",
        },
        // Add CSS variables for better dark mode support
        "main-foreground": "var(--main-foreground)",
      },
      fontFamily: {
        base: ["Inter", "sans-serif"],
        heading: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}