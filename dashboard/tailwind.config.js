/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter Tight",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Monaco",
          "monospace",
        ],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        peach: "var(--peach)",
        "peach-ink": "var(--peach-ink)",
        lavender: "var(--lavender)",
        "lavender-ink": "var(--lavender-ink)",
        mint: "var(--mint)",
        "mint-ink": "var(--mint-ink)",
        yellow: "var(--yellow)",
        "yellow-ink": "var(--yellow-ink)",
        red: "var(--red)",
        "red-soft": "var(--red-soft)",
      },
      borderRadius: {
        DEFAULT: "14px",
      },
    },
  },
  plugins: [],
};
