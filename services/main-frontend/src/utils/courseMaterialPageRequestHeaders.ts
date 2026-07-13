import type { Dictionary } from "lodash"

const referrerIsTheCurrentSite = (referrer: string): boolean => {
  try {
    const referrerUrl = new URL(referrer)
    return referrerUrl.hostname === window.location.hostname
  } catch {
    return false
  }
}

export const getCourseMaterialPageRequestHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {}

  if (
    document.referrer &&
    document.referrer !== "" &&
    !referrerIsTheCurrentSite(document.referrer)
  ) {
    headers["Orignal-Referrer"] = document.referrer
  }

  const currentUrl = new URL(document.location.href)
  const utmTags: Dictionary<string> = {}
  Array.from(currentUrl.searchParams.entries()).forEach(([key, value]) => {
    if (key.startsWith("utm_")) {
      utmTags[key] = value
    }
  })

  if (Object.keys(utmTags).length > 0) {
    headers["utm-tags"] = JSON.stringify(utmTags)
  }

  // Detect a browser controlled by automation to exclude it from visitor counts.
  if (!navigator.webdriver) {
    headers["totally-not-a-bot"] = "true"
  }

  return headers
}
