import courseMaterial from "../../src/shared-module/locales/en/course-material.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "course-material"
    resources: {
      "course-material": typeof courseMaterial
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
