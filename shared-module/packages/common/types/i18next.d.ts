import "i18next"
import type errors from "../src/locales/en/errors.json"
import type sharedModule from "../src/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "shared-module"
    fallbackNS: ["shared-module", "errors"]
    resources: {
      "shared-module": typeof sharedModule
      errors: typeof errors
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
