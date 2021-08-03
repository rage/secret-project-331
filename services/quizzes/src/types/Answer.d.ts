import { Quiz } from "./Quiz"

export interface Answer {
  id: string
  quizId: string
  userId: number
  languageId: string
  status: string
  createdAt: string
  updatedAt: string
  userQuizState: UserQuizState
  itemAnswers: ItemAnswer[]
  peerReviews: PeerReview[]
  quiz: Quiz
  deleted: boolean
}

export interface ItemAnswer {
  id: string
  quizAnswerId: string
  quizItemId: string
  textData: string
  intData: null
  correct: boolean
  createdAt: string
  updatedAt: string
  optionAnswers: OptionAnswer[]
}

export interface OptionAnswer {
  id: string
  quizItemAnswerId: string
  quizOptionId: string
  createdAt: string
  updatedAt: string
}

export interface PeerReview {
  id: string
  quizAnswerId: string
  userId: number
  peerReviewCollectionId: string
  rejectedQuizAnswerIds: string[]
  createdAt: string
  updatedAt: string
  answers: AnswerElement[]
}

export interface AnswerElement {
  peerReviewId: string
  peerReviewQuestionId: string
  value: number
  text: null
  createdAt: string
  updatedAt: string
  question: Question
}

export interface Question {
  id: string
  quizId: string
  peerReviewCollectionId: string
  default: boolean
  type: string
  answerRequired: boolean
  order: number
  createdAt: string
  updatedAt: string
  texts: Text[]
  title: string
  body: string
}

export interface Text {
  peerReviewQuestionId: string
  languageId: LanguageID
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface UserQuizState {
  userId: number
  quizId: string
  peerReviewsGiven: number
  peerReviewsReceived: number
  pointsAwarded: number
  spamFlags: number
  tries: number
  status: string
  createdAt: string
  updatedAt: string
}
