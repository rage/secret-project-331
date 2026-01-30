const languages: Record<string, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
}

const getFallbackLanguageName = (ietfLanguageTag: string): string => {
  let nameNotSpecificToRegion = null
  if (ietfLanguageTag.indexOf("-") !== -1) {
    const [language, _region] = ietfLanguageTag.split("-")
    const name = languages[language]
    if (name) {
      nameNotSpecificToRegion = name
    }
  }
  const nameSpecificToRegion = languages[ietfLanguageTag]
  return nameSpecificToRegion ?? nameNotSpecificToRegion ?? ietfLanguageTag
}

/**
 * Converts an IETF language tag to a human-readable language name.
 * @param ietfLanguageTag - The language tag to convert (e.g., "en", "fi", "en-US")
 * @param displayLocale - Optional locale for displaying the name. Defaults to the language tag itself.
 * @returns Human-readable language name (e.g., "English", "Suomi")
 * @example
 * ietfLanguageTagToHumanReadableName("en") // "English"
 * ietfLanguageTagToHumanReadableName("fi") // "Suomi"
 * ietfLanguageTagToHumanReadableName("en-US") // "American English"
 * ietfLanguageTagToHumanReadableName("en", "fi") // "englanti" (English in Finnish)
 */
const ietfLanguageTagToHumanReadableName = (
  ietfLanguageTag: string,
  displayLocale?: string,
): string => {
  const hasIntl = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  if (!hasIntl) {
    return getFallbackLanguageName(ietfLanguageTag)
  }
  try {
    const displayNames = new Intl.DisplayNames(displayLocale ?? ietfLanguageTag, {
      type: "language",
    })
    const name = displayNames.of(ietfLanguageTag)
    if (name) {
      return name
    }
  } catch {
    // Intl.DisplayNames failed, will try fallback
  }
  return getFallbackLanguageName(ietfLanguageTag)
}

export default ietfLanguageTagToHumanReadableName
