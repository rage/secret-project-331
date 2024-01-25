import "i18next"

import ownTranslations from "../src/shared-module/common/locales/en/quizzes.json"
import sharedModule from "../src/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "quizzes"
    fallbackNS: "shared-module"
    resources: {
      quizzes: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
