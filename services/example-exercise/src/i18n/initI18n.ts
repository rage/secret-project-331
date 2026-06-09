import i18n from "i18next"
import { initReactI18next } from "react-i18next"

/**
 * Initialises i18next for the exercise service. Translations are loaded lazily per language from
 * the local `src/locales` directory, so the bundle only ever contains the active language.
 */
const initI18n = (defaultNS: string): typeof i18n => {
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
          const resources = await import(`../locales/${language}/${namespace}.json`)
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

export default initI18n
