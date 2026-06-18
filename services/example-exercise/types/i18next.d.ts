import "i18next"

import ownTranslations from "@/locales/en/example-exercise.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "example-exercise"
    resources: {
      "example-exercise": typeof ownTranslations
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
