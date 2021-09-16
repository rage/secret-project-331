// import the original type declarations
import "react-i18next"

import mainFrontend from "../src/shared-module/locales/en-US/main-frontend.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "main-frontend"
    resources: {
      "main-frontend": typeof mainFrontend
    }
  }
}
