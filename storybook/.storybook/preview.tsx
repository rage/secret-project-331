"use client"

import type { Preview } from "@storybook/react-vite"
import i18next from "i18next"
import { I18nextProvider, initReactI18next } from "react-i18next"

import { tokensGlobal } from "../src/shared-module/components"

if (!i18next.isInitialized) {
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
          "story.dateTime.default": "Default",
          "story.dateTime.disabled": "Disabled",
          "story.dateTime.invalid": "Invalid",
          "story.dateTime.invalidMessage": "Date and time are required",
          "story.dateTime.playgroundLabel": "Publish at",
          "story.time.default": "Default",
          "story.time.disabled": "Disabled",
          "story.time.invalid": "Invalid",
          "story.time.invalidMessage": "Time is required",
          "story.time.playgroundLabel": "Start time",
        },
      },
    },
  })
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18next}>
        <Story />
      </I18nextProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: { toc: true },
  },

  tags: ["autodocs"],
}

export default preview

void tokensGlobal
