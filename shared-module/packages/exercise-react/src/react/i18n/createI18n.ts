import i18n from "i18next"
import { initReactI18next } from "react-i18next"

export type LoadTranslations = (language: string, namespace: string) => Promise<unknown>

/**
 * Initialises i18next for an exercise service. Translations are loaded lazily per language via the
 * provided `loadTranslations` callback, which keeps the service-specific locale files out of this
 * shared package while sharing the i18next configuration across all exercise services.
 */
export function createI18n(defaultNS: string, loadTranslations: LoadTranslations): typeof i18n {
  // eslint-disable-next-line import/no-named-as-default-member
  i18n
    .use(initReactI18next)
    .use({
      type: "backend",
      async read(
        language: string,
        namespace: string,
        callback: (errorValue: unknown, translations: unknown) => void,
      ) {
        try {
          const resources = await loadTranslations(language, namespace)
          callback(null, resources)
        } catch (error) {
          console.error("Could not load translations", error)
          callback(error, null)
        }
      },
    })
    .init({
      ns: [defaultNS],
      defaultNS,
      fallbackLng: "en",
      interpolation: {
        escapeValue: false, // react already escapes
      },
      react: {
        useSuspense: false,
      },
    })
  return i18n
}

export default createI18n
