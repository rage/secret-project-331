/* eslint-disable i18next/no-literal-string */
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"

export const MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS = "You should see this after a submission"
export const ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS =
  "This spoils the answer, and you should only see it in the model solution."
export const SUCCESS_MESSAGE_CANARY_FOR_TESTS =
  "You got it right! This spoils the answer, and should only be visible when you answer correctly."
export const SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS = "This may spoil the answer"
export const FAILURE_MESSAGE_CANARY_FOR_TESTS =
  "You got it wrong! But this might also spoil something"
export const VALIDITY_REGEX_CANARY_FOR_TESTS = "^This one spoils the correct answer$"
export const OPTION_CELLS_CANARY_FOR_TESTS = "234223523"
export const MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS = "This message is the model solution."

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
    validityRegex: VALIDITY_REGEX_CANARY_FOR_TESTS,
    formatRegex: "[a-z]+",
    title: "What color is the sky?",
    body: null,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
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
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    sharedOptionFeedbackMessage: SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS,
    optionDisplayDirection: "vertical",
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    fogOfWar: false,
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneEssayQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemEssay = {
    type: "essay",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    title: "What color is the sky?",
    body: null,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    minWords: 20,
    maxWords: 100,
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneScaleQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemScale = {
    type: "scale",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    maxValue: 1,
    minValue: 5,
    maxLabel: "Max label",
    minLabel: "Min label",
    title: null,
    body: null,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneCheckboxQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemCheckbox = {
    type: "checkbox",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    title: "Will you check this box?",
    body: null,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneMatrixQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemMatrix = {
    type: "matrix",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    optionCells: [
      ["1", "2"],
      ["3", OPTION_CELLS_CANARY_FOR_TESTS],
    ],
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneTimelineQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemTimeline = {
    type: "timeline",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    timelineItems: [
      {
        id: "1",
        year: "2000",
        correctEventName: "Event 1",
        correctEventId: "event-1",
      },
    ],
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneChooseNQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemChooseN = {
    type: "choose-n",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    n: 10,
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
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemMultiplechoiceDropdown = {
    type: "multiple-choice-dropdown",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    successMessage: SUCCESS_MESSAGE_CANARY_FOR_TESTS,
    failureMessage: FAILURE_MESSAGE_CANARY_FOR_TESTS,
    messageOnModelSolution: MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
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
  }

  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}
