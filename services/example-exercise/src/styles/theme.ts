// Minimal set of design tokens used by this example exercise. A real service usually imports a
// shared theme; the example inlines just the few colors it needs so it stays self-contained.
export const baseTheme = {
  colors: {
    blue: { 300: "#90ABC3", 500: "#46749B", 700: "#08457A" },
    green: { 300: "#8FB4B2", 400: "#6A9B98", 500: "#44827E" },
    red: { 300: "#D3A49A" },
    primary: { 100: "#FFFFFF", 200: "#000000" },
  },
} as const
