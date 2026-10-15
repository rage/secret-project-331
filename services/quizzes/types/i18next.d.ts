import "i18next"
import type errors from "@/shared-module/common/locales/en/errors.json"
import type ownTranslations from "@/shared-module/common/locales/en/quizzes.json"
import type sharedModule from "@/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "quizzes"
    fallbackNS: "shared-module"
    resources: {
      quizzes: typeof ownTranslations
      "shared-module": typeof sharedModule
      errors: typeof errors
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
