import "i18next"

import ownTranslations from "@/shared-module/common/locales/en/cms.json"
import sharedModule from "@/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "cms"
    fallbackNS: "shared-module"
    resources: {
      cms: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
