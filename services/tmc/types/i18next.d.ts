import "i18next"

import sharedModule from "../src/shared-module/locales/en/shared-module.json"
import ownTranslations from "../src/shared-module/locales/en/tmc.json"

const allAvailableTranslations = { ...sharedModule, ...ownTranslations }

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof allAvailableTranslations
    resources: {
      tmc: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
