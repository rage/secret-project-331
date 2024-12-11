import { dir } from "i18next"
import { useRouter } from "next/router"

import { LANGUAGE_COOKIE_KEY } from "../utils/constants"
import { getValueFromCookieString } from "../utils/cookies"

const LANGUAGE_QUERY_KEY = "lang"
const IS_SERVER = typeof window === "undefined"

const SUPPORTED_LANGUAGES = ["en", "fi", "uk"]
const DEFAULT_LANGUAGE = "en"

const CAN_ACCESS_COOKIES = detectAccessToCookies()

export function getDir(language: string) {
  try {
    return dir(language)
  } catch (e) {
    // eslint-disable-next-line i18next/no-literal-string
    return "ltr"
  }
}

// If language is specified with the `lang` query param, use that and save that as a langauge preference.
// Otherwise use either the saved language preference or detect the desired language
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

  if (!IS_SERVER && CAN_ACCESS_COOKIES) {
    // Remember the selected language in a cookie
    // eslint-disable-next-line i18next/no-literal-string
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${selectedLanguage}; path=/; SameSite=Strict; max-age=31536000;`

    // Set html lang=lang attribute
    document.documentElement.lang = selectedLanguage
    // Set right text direction
    document.documentElement.dir = getDir(selectedLanguage)
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
    let previouslySelectedLanguage = null
    if (CAN_ACCESS_COOKIES) {
      // Detect langauge from a saved cookie. The cookie will be set when the user selects a language from the language switcher
      // We default with the detection to that one so that the user does not have to repeatedly switch their language to their preferred one
      previouslySelectedLanguage = getValueFromCookieString(document.cookie, LANGUAGE_COOKIE_KEY)
    }

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

function detectAccessToCookies() {
  try {
    const cookie = document.cookie
    return cookie !== "wat"
  } catch (e) {
    return false
  }
}
