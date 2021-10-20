import cms from "../src/shared-module/locales/en/cms.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "cms"
    resources: {
      cms: typeof cms
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
