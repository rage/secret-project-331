export function getValueFromCookieString(cookieString: string, key: string): string | null {
  const cookies = cookieString.split("; ")
  const wantedCookie = cookies.find((c) => c.startsWith(key))
  if (!wantedCookie) {
    return null
  }
  const parts = wantedCookie.split("=")
  if (parts.length < 2) {
    return null
  }
  return parts[1]
}
