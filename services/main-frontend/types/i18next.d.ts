import "i18next"
import type countries from "@/shared-module/common/locales/en/countries.json"
import type creditRegistration from "@/shared-module/common/locales/en/credit-registration.json"
import type ownTranslations from "@/shared-module/common/locales/en/main-frontend.json"
import type sharedModule from "@/shared-module/common/locales/en/shared-module.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "main-frontend"
    fallbackNS: ["main-frontend", "shared-module"]
    resources: {
      "main-frontend": typeof ownTranslations
      "credit-registration": typeof creditRegistration
      "shared-module": typeof sharedModule
      countries: typeof countries
    }
    allowObjectInHTMLChildren: true
  }

  type Trans = string // typeof Reacti18Next.Trans
}
