import "i18next"

import ownTranslations from "../src/shared-module/locales/en/cms.json"
import sharedModule from "../src/shared-module/locales/en/shared-module.json"

const allAvailableTranslations = { ...sharedModule, ...ownTranslations }

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof allAvailableTranslations
    resources: {
      cms: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
