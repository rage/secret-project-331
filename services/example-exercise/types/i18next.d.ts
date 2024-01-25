import "i18next"

import ownTranslations from "../src/shared-module/common/locales/en/example-exercise.json"
import sharedModule from "../src/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "example-exercise"
    fallbackNS: "shared-module"
    resources: {
      "example-exercise": typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
