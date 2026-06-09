import { createI18n } from "@/shared-module/exercise-plugins/react/i18n/createI18n"

/**
 * Initialises i18next for this exercise service. The i18next configuration is shared from the
 * exercise-plugins package; only the translation loading stays here, because the locale files live
 * in this service's local `src/locales` directory (the dynamic import is resolved relative to this
 * file, so the bundle only ever contains the active language).
 */
const initI18n = (defaultNS: string) =>
  createI18n(defaultNS, (language, namespace) => import(`../locales/${language}/${namespace}.json`))

export default initI18n
