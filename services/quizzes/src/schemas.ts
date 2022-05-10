/* eslint-disable i18next/no-literal-string */
import { schema } from "normalizr"

export const options = new schema.Entity("options")
export const timelineItems = new schema.Entity("timelineItems")

export const items = new schema.Entity("items", {
  options: [options],
  timelineItems: [timelineItems],
})

export const normalizedQuiz = new schema.Entity("quizzes", {
  items: [items],
})
