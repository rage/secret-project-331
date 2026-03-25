import i18next from "i18next"
import { initReactI18next } from "react-i18next"

// i18next.use is the instance method, not the `use` hook export.
// eslint-disable-next-line import/no-named-as-default-member -- instance plugin registration
void i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: {
        "button.loading": "Loading",
        "checkbox.setField": "Set {{fieldName}}",
        "comboBox.toggleOptions": "Toggle options",
        "fileField.chooseFile": "Choose file",
        "fileField.empty": "No file selected",
        "fileField.moreFiles": "+{{count}} more",
        "fileField.unnamed": "Unnamed file",
        "link.loading": "Loading",
        "listBox.noResults": "No results found",
        "otp.slotLabel": "Code character {{index}}",
      },
    },
  },
})

export { i18next as testI18n }
