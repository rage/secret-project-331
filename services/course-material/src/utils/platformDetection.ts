export const isMac = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac/.test(navigator.userAgent)
}

export const getModifierKey = (): "Meta" | "Control" => {
  return isMac() ? "Meta" : "Control"
}

export const getModifierSymbol = (): string => {
  return isMac() ? "⌘" : "Ctrl"
}

export const getShiftSymbol = (): string => {
  return isMac() ? "⇧" : "Shift"
}

export const formatKeyboardShortcut = (keys: string[]): string => {
  return keys
    .map((key) => {
      switch (key) {
        case "Meta":
        case "Control":
          return getModifierSymbol()
        case "Shift":
          return getShiftSymbol()
        default:
          return key
      }
    })
    .join(isMac() ? "" : "+")
}
