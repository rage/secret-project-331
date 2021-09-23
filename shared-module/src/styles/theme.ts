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
    grey: {
      100: "#f5f5f5",
      200: "#eeeeee",
      300: "#e0e0e0",
      400: "#bdbdbd",
      500: "#9e9e9e",
      600: "#757575",
      700: "#616161",
      800: "#333333",
    },
    red: {
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
      // 200: "#f4f5f7",
      // 300: "#e1e1e1",
      // 400: "#737581",
      // 500: "#4a4b53",
      200: "#000000",
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
    hoverBorder: baseTheme.colors.blue[100],
    focusBorder: baseTheme.colors.neutral[100],
    activeBg: baseTheme.colors.neutral[100],
    disabledText: baseTheme.colors.neutral[100],
    disabledBg: baseTheme.colors.neutral[100],
    disabledBorder: baseTheme.colors.neutral[100],
  },
  secondary: {
    text: baseTheme.colors.neutral[100],
    border: baseTheme.colors.neutral[100],
    bg: baseTheme.colors.red[100],
    hoverText: baseTheme.colors.neutral[100],
    hoverBg: baseTheme.colors.red[200],
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
