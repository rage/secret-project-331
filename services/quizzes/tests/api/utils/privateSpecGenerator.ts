import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemClosedEndedQuestion,
} from "../../../types/quizTypes/privateSpec"

export function generateEmptyPrivateSpecQuiz(): PrivateSpecQuiz {
  return {
    version: "2",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [],
    title: null,
    body: null,
    quizItemDisplayDirection: "vertical",
    submitMessage: null,
  }
}

export function generatePrivateSpecWithOneClosedEndedQuestionQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemClosedEndedQuestion = {
    type: "closed-ended-question",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    validityRegex: "^blue$",
    formatRegex: "[a-z]+",
    title: "What color is the sky?",
    body: null,
    successMessage: null,
    failureMessage: null,
  }
  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}
