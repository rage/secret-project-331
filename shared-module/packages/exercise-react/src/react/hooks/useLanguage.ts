"use client"

import { dir } from "i18next"
import { useEffect, useSyncExternalStore } from "react"

import { LANGUAGE_COOKIE_KEY } from "@/shared-module/exercise-client/utils/constants"
import { getValueFromCookieString } from "@/shared-module/exercise-client/utils/cookies"
import {
  DEFAULT_LANGUAGE,
  mapLanguageCandidateToSupportedLanguage,
} from "@/shared-module/exercise-client/utils/language"

const LANGUAGE_QUERY_KEY = "lang"
const IS_SERVER = typeof window === "undefined"

export {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from "@/shared-module/exercise-client/utils/language"
export type { SupportedLanguage as SUPPORTED_LANGUAGES_KEYS } from "@/shared-module/exercise-client/utils/language"

const CAN_ACCESS_COOKIES = detectAccessToCookies()

export function getDir(language: string) {
  try {
    return dir(language)
  } catch {
    return "ltr"
  }
}

// Framework-agnostic: subscribe to History navigations and read the `lang` query param directly
// from the URL, so this hook works in any bundler it is vendored into.
function subscribeToLocation(callback: () => void): () => void {
  if (IS_SERVER) {
    return () => {
      /* nothing to unsubscribe on the server */
    }
  }
  window.addEventListener("popstate", callback)
  return () => window.removeEventListener("popstate", callback)
}

function getLangQueryValue(): string | null {
  if (IS_SERVER) {
    return null
  }
  return new URLSearchParams(window.location.search).get(LANGUAGE_QUERY_KEY)
}

// If language is specified with the `lang` query param, use that and save that as a langauge preference.
// Otherwise use either the saved language preference or detect the desired language
export default function useLanguage(): string | null {
  const value = useSyncExternalStore(subscribeToLocation, getLangQueryValue, () => null)
  const languageCandidate = determineLanguageFromQueryValue(value || undefined)

  // We map the candidate to supported languages to be absolutely sure we're returning a supported language
  const selectedLanguage = languageCandidate
    ? (mapLanguageCandidateToSupportedLanguage(languageCandidate) ?? DEFAULT_LANGUAGE)
    : null

  useEffect(() => {
    if (!selectedLanguage || IS_SERVER || !CAN_ACCESS_COOKIES) {
      return
    }
    // Remember the selected language in a cookie
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${selectedLanguage}; path=/; SameSite=Strict; max-age=31536000;`

    // Set html lang=lang attribute
    document.documentElement.lang = selectedLanguage
    // Set right text direction
    document.documentElement.dir = getDir(selectedLanguage)
  }, [selectedLanguage])

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
      const supportedLanguage = mapLanguageCandidateToSupportedLanguage(previouslySelectedLanguage)
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
      const language = mapLanguageCandidateToSupportedLanguage(pl)
      if (language) {
        return language
      }
    }
    return null
  }

  // In case of `example.com?lng=en&lng=fi`, we will return `fi`
  if (Array.isArray(value)) {
    return value.at(-1) ?? null
  }
  return value
}

function detectAccessToCookies() {
  try {
    const cookie = document.cookie
    return cookie !== "wat"
  } catch {
    return false
  }
}
