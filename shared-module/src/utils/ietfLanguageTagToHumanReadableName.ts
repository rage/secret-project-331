/* eslint-disable i18next/no-literal-string */
const languages: Record<string, string> = {
  en: "English",
  fi: "Suomi",
  sv: "Svenska",
}

const ietfLanguageTagToHumanReadableName = (ietfLanguageTag: string): string => {
  /// split to two parts
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

export default ietfLanguageTagToHumanReadableName
