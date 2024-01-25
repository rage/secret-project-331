import "i18next"

import sharedModule from "../src/shared-module/common/locales/en/shared-module.json"
import ownTranslations from "../src/shared-module/common/locales/en/tmc.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "tmc"
    fallbackNS: "shared-module"
    resources: {
      tmc: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
