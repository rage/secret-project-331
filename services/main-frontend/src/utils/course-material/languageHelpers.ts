import { useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"

import { LANGUAGE_COOKIE_KEY } from "@/shared-module/common/utils/constants"
import { courseLanguagePreferenceAtom } from "@/state/courseLanguagePreference"

/**
 * Changes the language in course material context.
 * Updates i18n, cookie, and course language preference state.
 */
export function useChangeCourseMaterialLanguage() {
  const { i18n } = useTranslation()
  const setPreference = useSetAtom(courseLanguagePreferenceAtom)

  return (languageCode: string) => {
    i18n.changeLanguage(languageCode)

    document.cookie = `${LANGUAGE_COOKIE_KEY}=${languageCode}; path=/; SameSite=Strict; max-age=31536000;`
    setPreference(languageCode)
  }
}
