// Minimal set of design tokens used by this example exercise. A real service usually imports a
// shared theme; the example inlines just the few colors it needs so it stays self-contained.
//
// Contrast: every token used as *text* on the light `surface` background meets WCAG 2.1 AA
// (>= 4.5:1). The gray ramp's 100-300 steps are surfaces/borders only (too light for text);
// `gray[500]` is the lightest gray that still passes as body text on white.
export const baseTheme = {
  colors: {
    blue: { 300: "#90ABC3", 500: "#46749B", 700: "#08457A" },
    green: { 300: "#8FB4B2", 400: "#6A9B98", 500: "#44827E" },
    red: { 300: "#D3A49A" },
    primary: { 100: "#FFFFFF", 200: "#000000" },
    // Neutral gray ramp for surfaces, borders and secondary text.
    gray: {
      100: "#F5F6F7", // lightest surface / hover fill
      200: "#E1E3E6", // subtle borders / dividers
      300: "#C4C8CC", // stronger borders
      500: "#6B7178", // secondary text (>= 4.5:1 on white)
      700: "#2B2F33", // primary text
    },
  },
  // Semantic tokens. The `*Text` values are safe as text on `surface` (>= 4.5:1) and on their
  // paired `*Background`; the backgrounds themselves are decorative and carry no text-contrast
  // requirement.
  semantic: {
    surface: "#FFFFFF",
    inputBackground: "#FFFFFF",
    success: {
      text: "#1B7A3D", // 5.39:1 on white
      background: "#E6F4EA",
      border: "#44827E",
    },
    error: {
      text: "#C0261C", // 5.94:1 on white
      background: "#FCE8E6",
      border: "#B3271E",
    },
  },
} as const
