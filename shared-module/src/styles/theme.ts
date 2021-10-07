export const baseTheme = {
  space: [0, 2, 4, 8, 16, 32],
  fontSizes: [14, 16, 18, 24, 32],
  colors: {
    blue: {
      100: "#36A5F2",
      200: "#55B3F5",
      300: "#77C1F5",
      400: "#5f25a4",
      500: "#050449",
    },
    green: {
      100: "#37BC9B",
      200: "#48CFAD",
      300: "#62DDBD",
    },
    yellow: {
      100: "#f6bb42",
      200: "#ffce54",
      300: "#FCD277",
    },
    red: {
      100: "#da4453",
      200: "#ed5565",
      300: "#f76d82",
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
    bg: baseTheme.colors.green[100],
    hoverText: baseTheme.colors.blue[200],
    hoverBg: baseTheme.colors.neutral[100],
    hoverBorder: baseTheme.colors.green[100],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    secondary: {
      text: baseTheme.colors.neutral[800],
      border: baseTheme.colors.neutral[100],
      bg: baseTheme.colors.neutral[400],
      hoverText: baseTheme.colors.neutral[800],
      hoverBg: baseTheme.colors.neutral[300],
      hoverBorder: baseTheme.colors.neutral[600],
      focusBorder: baseTheme.colors.neutral[100],
      activeBg: baseTheme.colors.neutral[100],
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
      buttonSizes: {
        medium: {
          fontSize: baseTheme.fontSizes[2],
          padding: `9px 18px`,
        },
        large: {
          fontSize: baseTheme.fontSizes[4],
          padding: `16px 34px`,
        },
      },
    },
  },
}
