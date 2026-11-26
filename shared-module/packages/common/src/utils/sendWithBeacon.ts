function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined"
}

export function sendWithBeacon(url: string, body: string): boolean {
  if (
    !isBrowserEnvironment() ||
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false
  }

  try {
    const blob = new Blob([body], { type: "application/json" })
    return navigator.sendBeacon(url, blob) === true
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("reportErrorOccurrence sendBeacon failed", error)
    }
    return false
  }
}
