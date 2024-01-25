import "i18next"

import ownTranslations from "../src/shared-module/common/locales/en/course-material.json"
import sharedModule from "../src/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "course-material"
    fallbackNS: "shared-module"
    resources: {
      "course-material": typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
