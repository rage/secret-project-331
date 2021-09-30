// import the original type declarations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Reacti18Next from "react-i18next"

import courseMaterial from "../src/shared-module/locales/en-US/course-material.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "course-material"
    resources: {
      "course-material": typeof courseMaterial
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
