import i18n from "i18next"
import { initReactI18next } from "react-i18next"

const initI18n = (defaultNS: string): typeof i18n => {
  i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .use({
      type: "backend",
      async read(
        language: string,
        namespace: string,
        callback: (errorValue: unknown, translations: unknown) => void,
      ) {
        try {
          // this does webpack code splitting, so that we only load the language and the namespace we need
          const resources = await import(`../locales/${language}/${namespace}.json`)
          callback(null, resources)
        } catch (error) {
          // @ts-ignore: checks for existance of the field
          if (error.code === "MODULE_NOT_FOUND") {
            callback(null, {})
            return
          }
          console.error("Could not load translations", error)
          callback(error, null)
        }
      },
    })
    .init({
      // eslint-disable-next-line i18next/no-literal-string
      ns: [defaultNS, "shared-module"],
      defaultNS,
      // eslint-disable-next-line i18next/no-literal-string
      fallbackLng: "en",
      interpolation: {
        escapeValue: false, // react does the escaping
      },
      react: {
        useSuspense: false,
      },
    })
  return i18n
}

export default initI18n
