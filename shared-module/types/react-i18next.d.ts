import sharedModule from "../src/locales/en/shared-module.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "shared-module"
    resources: {
      "shared-module": typeof sharedModule
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
