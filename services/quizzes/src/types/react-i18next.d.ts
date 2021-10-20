import mainFrontend from "../shared-module/locales/en/quizzes.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "quizzes"
    resources: {
      quizzes: typeof mainFrontend
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
