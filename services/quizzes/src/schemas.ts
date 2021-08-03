import { schema } from "normalizr"

export const options = new schema.Entity("options")

export const items = new schema.Entity("items", {
  options: [options],
})

export const questions = new schema.Entity("questions")

export const peerReviewCollections = new schema.Entity("peerReviewCollections", {
  questions: [questions],
})

export const normalizedQuiz = new schema.Entity("quizzes", {
  items: [items],
  peerReviewCollections: [peerReviewCollections],
})
