export const SUPPORTED_LANGUAGES = ["en", "fi", "uk", "sv", "no"] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = "en"

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  nb: "no",
  nn: "no",
}

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
}

export function mapLanguageCandidateToSupportedLanguage(
  languageCandidate: string,
): SupportedLanguage | null {
  const normalizedLanguageCandidate = languageCandidate.trim().toLowerCase()
  if (!normalizedLanguageCandidate) {
    return null
  }

  const exactMatch = LANGUAGE_ALIASES[normalizedLanguageCandidate] ?? normalizedLanguageCandidate
  if (isSupportedLanguage(exactMatch)) {
    return exactMatch
  }

  const primarySubtag = normalizedLanguageCandidate.split(/[-_]/)[0]
  const aliasedPrimarySubtag = LANGUAGE_ALIASES[primarySubtag] ?? primarySubtag
  if (isSupportedLanguage(aliasedPrimarySubtag)) {
    return aliasedPrimarySubtag
  }

  return null
}
