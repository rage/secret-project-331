import { useRouter } from "next/router"

import { getValueFromCookieString } from "../utils/cookies"

const LANGUAGE_QUERY_KEY = "lng"
const IS_SERVER = typeof window === "undefined"
const LANGUAGE_COOKIE_KEY = "selected-language"

const SUPPORTED_LANGUAGES = ["en", "fi"]
const DEFAULT_LANGUAGE = "en"

export default function useLanguage(): string | null {
  const router = useRouter()
  if (!router || !router.isReady) {
    return null
  }
  const value = router?.query[LANGUAGE_QUERY_KEY]
  const languageCandidate = determineLanguageFromQueryValue(value)

  if (!languageCandidate) {
    return null
  }

  // We map the candidate to supported languages to be absolutely sure we're returning a supported language
  const selectedLanguage =
    mapLanguageCadidateToSupportedLanguage(languageCandidate) ?? DEFAULT_LANGUAGE

  // Replace the selected language in the current URL's query string
  if (!IS_SERVER && "URLSearchParams" in window) {
    const queryString = new URLSearchParams(window.location.search)
    queryString.set(LANGUAGE_QUERY_KEY, selectedLanguage)
    history.replaceState(null, "", `${window.location.pathname}?${queryString}`)
  }

  return selectedLanguage
}

function determineLanguageFromQueryValue(value: string | string[] | undefined): string | null {
  if (!value) {
    // No language query param passed, we can detect a language to use
    if (IS_SERVER) {
      // If we're in the server skip the detection
      return null
    }
    // Detect langauge from a saved cookie. The cookie will be set when the user selects a language from the language switcher
    // We default with the detection to that one so that the user does not have to repeatedly switch their language to their preferred one
    const previouslySelectedLanguage = getValueFromCookieString(
      document.cookie,
      LANGUAGE_COOKIE_KEY,
    )

    if (previouslySelectedLanguage) {
      const supportedLanguage = mapLanguageCadidateToSupportedLanguage(previouslySelectedLanguage)
      // If the saved language is not supported, we fall back to the detecting the language from the navigator
      if (supportedLanguage) {
        return supportedLanguage
      }
    }

    // Detect language from the browser settings
    const preferredLanguages = navigator?.languages
    if (!preferredLanguages) {
      return null
    }
    for (const pl of preferredLanguages) {
      const language = mapLanguageCadidateToSupportedLanguage(pl)
      if (language) {
        return language
      }
    }
    return null
  }

  // In case of `example.com?lng=en&lng=fi`, we will return `fi`
  if (Array.isArray(value)) {
    return value[value.length - 1]
  }
  return value
}

// Returns the supported language or null if the the candidate is not supported
function mapLanguageCadidateToSupportedLanguage(navigatorLanguage: string): string | null {
  if (SUPPORTED_LANGUAGES.indexOf(navigatorLanguage) !== -1) {
    return navigatorLanguage
  }
  const languageParts = navigatorLanguage.split("-")
  if (SUPPORTED_LANGUAGES.indexOf(languageParts[0]) !== -1) {
    return languageParts[0]
  }
  return null
}
