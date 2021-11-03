import ownTranslations from "../src/shared-module/locales/en/cms.json"
import sharedModule from "../src/shared-module/locales/en/shared-module.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: ["cms", "shared-module"]
    resources: {
      cms: typeof ownTranslations
      "shared-module": typeof sharedModule
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
