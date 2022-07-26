import ownTranslations from "../src/shared-module/locales/en/example-exercise.json"
import sharedModule from "../src/shared-module/locales/en/shared-module.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: ["example-exercise", "shared-module"]
    resources: {
      "example-exercise": typeof ownTranslations
      "shared-module": typeof sharedModule
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
