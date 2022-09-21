import ownTranslations from "../src/shared-module/locales/en/course-material.json"
import sharedModule from "../src/shared-module/locales/en/shared-module.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: ["course-material", "shared-module"]
    resources: {
      "course-material": typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
