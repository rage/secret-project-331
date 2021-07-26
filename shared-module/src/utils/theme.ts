import { primaryFont } from "./typography"

export const baseTheme = {
  space: [0, 2, 4, 8, 16, 32],
  fontSizes: [14, 16, 18, 24, 32],
  colors: {
    blue: {
      100: "#3a36e0",
      200: "#0804b8",
      300: "#030086",
      400: "#5f25a4",
      500: "#050449",
    },
    green: {
      100: "#529e66",
      200: "#367b48",
      300: "#276738",
    },
    yellow: {
      100: "#e1c542",
      200: "#cab23f",
      300: "#b49e35",
    },
    red: {
      100: "#d0454c",
      200: "#b54248",
      300: "#95353a",
    },
    neutral: {
      100: "#ffffff",
      200: "#f4f5f7",
      300: "#e1e1e1",
      400: "#737581",
      500: "#4a4b53",
      600: "#000000",
    },
  },
}

export const theme = {
  primary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.blue[100],
    hoverText: baseTheme.colors.blue[200],
    hoverBg: baseTheme.colors.neutral[100],
    hoverBorder: baseTheme.colors.neutral[100],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  secondary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.blue[400],
    hoverText: baseTheme.colors.neutral[100],
    hoverBg: baseTheme.colors.neutral[100],
    hoverBorder: baseTheme.colors.neutral[100],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  tertiary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.yellow[100],
    hoverText: baseTheme.colors.neutral[100],
    hoverBg: baseTheme.colors.yellow[200],
    hoverBorder: baseTheme.colors.neutral[100],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  buttonSizes: {
    medium: {
      fontSize: baseTheme.fontSizes[2],
      padding: `9px 18px`,
    },
    large: {
      fontSize: baseTheme.fontSizes[4],
      padding: `18px 36px`,
    },
  },
}
