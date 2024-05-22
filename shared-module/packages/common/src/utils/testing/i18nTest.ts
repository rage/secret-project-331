/* eslint-disable i18next/no-literal-string */
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",

  // have a common namespace used around the full app
  ns: ["translationsNS"],
  defaultNS: "translationsNS",

  debug: false,

  interpolation: {
    escapeValue: false, // not needed for react!!
  },

  fallbackNS: "shared-module",
  resources: { en: { translationsNS: {} } },
})

const i18nTest = i18n

export default i18nTest
