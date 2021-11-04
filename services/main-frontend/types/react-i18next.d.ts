import ownTranslations from "../src/shared-module/locales/en/main-frontend.json"
import sharedModule from "../src/shared-module/locales/en/shared-module.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: ["main-frontend", "shared-module"]
    resources: {
      "main-frontend": typeof ownTranslations
      "shared-module": typeof sharedModule
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
