/* eslint-disable i18next/no-literal-string */
export const baseTheme = {
  space: [0, 2, 4, 8, 16, 32],
  fontSizes: [14, 16, 18, 24, 32],
  colors: {
    blue: {
      0: "#36A5F24D",
      100: "#36A5F2",
      200: "#55B3F5",
      300: "#77C1F5",
      400: "#5f25a4",
      500: "#050449",
    },
    green: {
      100: "#145A48",
      200: "#37BC9B",
      300: "#48CFAD",
      400: "#62DDBD",
      500: "#E0F4EF",
    },
    grey: {
      100: "#f5f5f5",
      200: "#eeeeee",
      300: "#e0e0e0",
      400: "#bdbdbd",
      500: "#9e9e9e",
      600: "#757575",
      700: "#616161",
      800: "#2f2f2f",
    },
    red: {
      0: "#FF000033",
      100: "#da4453",
      200: "#ed5565",
      300: "#f76d82",
    },
    yellow: {
      100: "#f6bb42",
      200: "#ffce54",
      300: "#FCD277",
    },
    neutral: {
      100: "#ffffff",
      200: "#f4f5f7",
      300: "#e1e1e1",
      400: "#c4c4c4",
      500: "#c5c5c5",
      600: "#858585",
      700: "#4a4b53",
      800: "#000000",
      900: "#333333",
    },
  },
}

export const theme = {
  primary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.green[200],
    hoverText: baseTheme.colors.blue[200],
    hoverBg: baseTheme.colors.neutral[100],
    hoverBorder: baseTheme.colors.green[200],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  secondary: {
    text: baseTheme.colors.neutral[800],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.neutral[200],
    hoverText: baseTheme.colors.neutral[800],
    hoverBg: baseTheme.colors.neutral[300],
    hoverBorder: baseTheme.colors.neutral[600],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  tertiary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.grey[800],
    hoverText: baseTheme.colors.grey[800],
    hoverBg: baseTheme.colors.neutral[100],
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
      padding: `0.5625rem 1.125rem`,
    },
    large: {
      fontSize: baseTheme.fontSizes[4],
      padding: `1rem 2.125rem`,
    },
  },
}
