import mainFrontend from "../src/shared-module/locales/en/main-frontend.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "main-frontend"
    resources: {
      "main-frontend": typeof mainFrontend
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
