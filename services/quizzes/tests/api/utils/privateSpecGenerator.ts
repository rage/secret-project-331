import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemMultiplechoice,
} from "../../../types/quizTypes/privateSpec"

export const MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS = "You should see this after a submission"
export const ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS =
  "This spoils the answer, and you should only see it in the model solution."
export const SUCCESS_MESSAGE_CANARY_FOR_TESTS =
  "You got it right! This spoils the answer, and should only be visible when you answer correctly."
export const SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS = "This may spoil the answer"

export function generateEmptyPrivateSpecQuiz(): PrivateSpecQuiz {
  return {
    version: "2",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [],
    title: null,
    body: null,
    quizItemDisplayDirection: "vertical",
    submitMessage: "This might also spoil something",
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

export function generatePrivateSpecWithOneMultipleChoiceQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemMultiplechoice = {
    type: "multiple-choice",
    shuffleOptions: false,
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    allowSelectingMultipleOptions: false,
    options: [
      {
        id: "id-1",
        order: 0,
        correct: true,
        title: "Positive",
        body: null,
        messageAfterSubmissionWhenSelected: MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS,
        additionalCorrectnessExplanationOnModelSolution:
          ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
      },
      {
        id: "id-2",
        order: 0,
        correct: false,
        title: "Just no",
        body: null,
        messageAfterSubmissionWhenSelected: MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS,
        additionalCorrectnessExplanationOnModelSolution:
          ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
      },
    ],
    title: null,
    body: null,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: "You got it wrong!",
    sharedOptionFeedbackMessage: "This spoils the answer",
    optionDisplayDirection: "vertical",
    multipleChoiceMultipleOptionsGradingPolicy: "default",
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}
