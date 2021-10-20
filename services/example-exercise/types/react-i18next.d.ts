import exampleExercise from "../src/shared-module/locales/en/example-exercise.json"

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "example-exercise"
    resources: {
      "example-exercise": typeof exampleExercise
    }
  }

  type Trans = string // typeof Reacti18Next.Trans
}
