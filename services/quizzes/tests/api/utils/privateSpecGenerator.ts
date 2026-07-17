import type { GradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"

import type { UserAnswer, UserItemAnswerMultiplechoice } from "../../../types/quizTypes/answer"
import type {
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
  QuizFeedbackMessage,
  QuizItemOption,
  QuizOptionFeedbackMessage,
} from "../../../types/quizTypes/privateSpec"

// One canary per feedback-message channel. A canary must never leak into a spec/model solution that
// its visibility does not permit; the leak tests stringify the output and assert absence.

// Item-level, one per visibility.
export const ITEM_AFTER_ANY_ANSWER_CANARY = "canary: item feedback shown after any answer"
export const ITEM_AFTER_CORRECT_CANARY =
  "canary: item feedback shown after a correct answer, spoils it"
export const ITEM_AFTER_PARTIALLY_CORRECT_CANARY =
  "canary: item feedback shown after a partially correct answer"
export const ITEM_AFTER_INCORRECT_CANARY = "canary: item feedback shown after an incorrect answer"
export const ITEM_ON_MODEL_SOLUTION_CANARY =
  "canary: item feedback shown only on the model solution"

// Option-level, one per visibility.
export const OPTION_WHEN_SELECTED_CANARY = "canary: option feedback shown when this option selected"
export const OPTION_ON_MODEL_SOLUTION_CANARY =
  "canary: option explanation shown only on the model solution"

// Quiz-level, one per exercised visibility.
export const QUIZ_AFTER_ANY_ANSWER_CANARY = "canary: quiz-level feedback shown after any answer"
export const QUIZ_ON_MODEL_SOLUTION_CANARY =
  "canary: quiz-level feedback shown only on the model solution"

export const VALIDITY_REGEX_CANARY_FOR_TESTS = "^This one spoils the correct answer$"
export const OPTION_CELLS_CANARY_FOR_TESTS = "234223523"

// Every after-answer canary plus the acceptance-rule canary: none of these may appear in a public
// spec, and none may appear in a model solution either.
export const AFTER_ANSWER_AND_ACCEPTANCE_CANARIES = [
  ITEM_AFTER_ANY_ANSWER_CANARY,
  ITEM_AFTER_CORRECT_CANARY,
  ITEM_AFTER_PARTIALLY_CORRECT_CANARY,
  ITEM_AFTER_INCORRECT_CANARY,
  OPTION_WHEN_SELECTED_CANARY,
  QUIZ_AFTER_ANY_ANSWER_CANARY,
  VALIDITY_REGEX_CANARY_FOR_TESTS,
]

// The on-model-solution canaries: allowed in the model solution, never in the public spec.
export const ON_MODEL_SOLUTION_CANARIES = [
  ITEM_ON_MODEL_SOLUTION_CANARY,
  OPTION_ON_MODEL_SOLUTION_CANARY,
  QUIZ_ON_MODEL_SOLUTION_CANARY,
]

const itemFeedbackMessages = (): QuizFeedbackMessage[] => [
  { visibility: "after-any-answer", message: ITEM_AFTER_ANY_ANSWER_CANARY },
  { visibility: "after-correct-answer", message: ITEM_AFTER_CORRECT_CANARY },
  { visibility: "after-partially-correct-answer", message: ITEM_AFTER_PARTIALLY_CORRECT_CANARY },
  { visibility: "after-incorrect-answer", message: ITEM_AFTER_INCORRECT_CANARY },
  { visibility: "on-model-solution", message: ITEM_ON_MODEL_SOLUTION_CANARY },
]

const optionFeedbackMessages = (): QuizOptionFeedbackMessage[] => [
  { visibility: "when-selected-after-answer", message: OPTION_WHEN_SELECTED_CANARY },
  { visibility: "on-model-solution", message: OPTION_ON_MODEL_SOLUTION_CANARY },
]

const quizFeedbackMessages = (): QuizFeedbackMessage[] => [
  { visibility: "after-any-answer", message: QUIZ_AFTER_ANY_ANSWER_CANARY },
  { visibility: "on-model-solution", message: QUIZ_ON_MODEL_SOLUTION_CANARY },
]

export function generateEmptyPrivateSpecQuiz(): PrivateSpecQuiz {
  return {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [],
    title: null,
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: quizFeedbackMessages(),
  }
}

export function generatePrivateSpecWithOneClosedEndedQuestionQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const closedEndedQuestionQuizItem: PrivateSpecQuizItemClosedEndedQuestion = {
    type: "closed-ended-question",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    gradingStrategy: {
      strategy: "regex",
      pattern: VALIDITY_REGEX_CANARY_FOR_TESTS,
      caseSensitive: true,
      matchWholeAnswer: false,
      exampleCorrectAnswer: null,
    },
    formatRegex: "[a-z]+",
    title: "What color is the sky?",
    body: null,
    feedbackMessages: itemFeedbackMessages(),
  }
  return { ...emptyQuiz, items: [closedEndedQuestionQuizItem] }
}

export function generatePrivateSpecWithOneMultipleChoiceQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const multipleChoiceQuizItem: PrivateSpecQuizItemMultiplechoice = {
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
        feedbackMessages: optionFeedbackMessages(),
      },
      {
        id: "id-2",
        order: 0,
        correct: false,
        title: "Just no",
        body: null,
        feedbackMessages: optionFeedbackMessages(),
      },
    ],
    title: null,
    body: null,
    feedbackMessages: itemFeedbackMessages(),
    optionDisplayDirection: "vertical",
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    fogOfWar: false,
  }

  return { ...emptyQuiz, items: [multipleChoiceQuizItem] }
}

export function generatePrivateSpecWithOneEssayQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const essayQuizItem: PrivateSpecQuizItemEssay = {
    type: "essay",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    title: "What color is the sky?",
    body: null,
    feedbackMessages: itemFeedbackMessages(),
    minWords: 20,
    maxWords: 100,
  }

  return { ...emptyQuiz, items: [essayQuizItem] }
}

export function generatePrivateSpecWithOneScaleQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const scaleQuizItem: PrivateSpecQuizItemScale = {
    type: "scale",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    maxValue: 1,
    minValue: 5,
    maxLabel: "Max label",
    minLabel: "Min label",
    title: null,
    body: null,
    feedbackMessages: itemFeedbackMessages(),
  }

  return { ...emptyQuiz, items: [scaleQuizItem] }
}

export function generatePrivateSpecWithOneCheckboxQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const checkboxQuizItem: PrivateSpecQuizItemCheckbox = {
    type: "checkbox",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    title: "Will you check this box?",
    body: null,
    feedbackMessages: itemFeedbackMessages(),
  }

  return { ...emptyQuiz, items: [checkboxQuizItem] }
}

export function generatePrivateSpecWithOneMatrixQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const matrixQuizItem: PrivateSpecQuizItemMatrix = {
    type: "matrix",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    feedbackMessages: itemFeedbackMessages(),
    optionCells: [
      ["1", "2"],
      ["3", OPTION_CELLS_CANARY_FOR_TESTS],
    ],
  }

  return { ...emptyQuiz, items: [matrixQuizItem] }
}

export function generatePrivateSpecWithOneTimelineQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const timelineQuizItem: PrivateSpecQuizItemTimeline = {
    type: "timeline",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    feedbackMessages: itemFeedbackMessages(),
    timelineItems: [
      {
        id: "1",
        year: "2000",
        correctEventName: "Event 1",
        correctEventId: "event-1",
      },
    ],
  }

  return { ...emptyQuiz, items: [timelineQuizItem] }
}

export function generatePrivateSpecWithOneChooseNQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const chooseNQuizItem: PrivateSpecQuizItemChooseN = {
    type: "choose-n",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    feedbackMessages: itemFeedbackMessages(),
    n: 10,
    options: [
      {
        id: "id-1",
        order: 0,
        correct: true,
        title: "Positive",
        body: null,
        feedbackMessages: optionFeedbackMessages(),
      },
      {
        id: "id-2",
        order: 0,
        correct: false,
        title: "Just no",
        body: null,
        feedbackMessages: optionFeedbackMessages(),
      },
    ],
    title: null,
    body: null,
  }

  return { ...emptyQuiz, items: [chooseNQuizItem] }
}

export function generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem(): PrivateSpecQuiz {
  const emptyQuiz = generateEmptyPrivateSpecQuiz()
  const dropdownQuizItem: PrivateSpecQuizItemMultiplechoiceDropdown = {
    type: "multiple-choice-dropdown",
    id: "988b9c17-9f03-4062-b5ff-c6071d3c6f06",
    order: 0,
    feedbackMessages: itemFeedbackMessages(),
    options: [
      {
        id: "id-1",
        order: 0,
        correct: true,
        title: "Positive",
        body: null,
        feedbackMessages: optionFeedbackMessages(),
      },
      {
        id: "id-2",
        order: 0,
        correct: false,
        title: "Just no",
        body: null,
        feedbackMessages: optionFeedbackMessages(),
      },
    ],
    title: null,
    body: null,
  }

  return { ...emptyQuiz, items: [dropdownQuizItem] }
}

/**
 * Generates a grading request with a multiple-choice quiz item.
 * First few options are correct and all the rest are incorrect.
 * Each item has an id of 'option-<order-number>'
 *
 * @param numberOfOptions Total number of options
 * @param numberOfCorrectOptions Number of correct options (from the start)
 * @param selectedOptionIds List of selected option IDs. E.g. ['option-1', 'option-3']
 * @param multipleChoiceMultipleOptionsGradingPolicy Grading policy for multiple selections
 * @param allowSelectingMultipleOptions If true, multiple options can be selected
 * @returns GradingRequest with PrivateSpecQuiz and UserAnswer
 */
export function generateMultipleChoiceGradingRequest(
  numberOfOptions: number,
  numberOfCorrectOptions: number,
  selectedOptionIds: string[],
  multipleChoiceMultipleOptionsGradingPolicy:
    | "default"
    | "points-off-incorrect-options"
    | "points-off-unselected-options"
    | "some-correct-none-incorrect",
  allowSelectingMultipleOptions = true,
): GradingRequest<PrivateSpecQuiz, UserAnswer> {
  const quizItemId = "multiple-choice-test-id"

  const quizOptions: QuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push({
      id: `option-${i + 1}`,
      order: i,
      correct: i < numberOfCorrectOptions,
      title: `Option ${i + 1}`,
      body: null,
      feedbackMessages: [],
    })
  }

  const multipleChoiceItem: PrivateSpecQuizItemMultiplechoice = {
    type: "multiple-choice",
    id: quizItemId,
    order: 0,
    allowSelectingMultipleOptions,
    shuffleOptions: false,
    options: quizOptions,
    title: "Test Multiple Choice",
    body: null,
    feedbackMessages: [],
    optionDisplayDirection: "vertical",
    multipleChoiceMultipleOptionsGradingPolicy,
    fogOfWar: false,
  }

  const privateSpecQuiz: PrivateSpecQuiz = {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [multipleChoiceItem],
    title: "Generated Multiple Choice Test",
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: [],
  }

  const userItemAnswer: UserItemAnswerMultiplechoice = {
    type: "multiple-choice",
    valid: true,
    quizItemId,
    selectedOptionIds,
  }

  const userAnswer: UserAnswer = {
    version: "4",
    itemAnswers: [userItemAnswer],
  }

  return {
    grading_update_url: "example",
    exercise_spec: privateSpecQuiz,
    submission_data: userAnswer,
  }
}

export function generateChooseNGradingRequest(
  totalOptions: number,
  correctOptions: number,
  selectedOptions: string[],
  n: number,
) {
  const options: QuizItemOption[] = []
  for (let i = 1; i <= totalOptions; i++) {
    options.push({
      id: `option-${i}`,
      order: i - 1,
      correct: i <= correctOptions,
      title: `Option ${i}`,
      body: null,
      feedbackMessages: [],
    })
  }

  const privateSpecQuiz: PrivateSpecQuiz = {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [
      {
        type: "choose-n",
        id: "choose-n-item",
        order: 0,
        n,
        options,
        title: "Choose N Test",
        body: null,
        feedbackMessages: [],
      },
    ],
    title: "Choose N Quiz",
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: [],
  }

  const userItemAnswer = {
    type: "choose-n" as const,
    quizItemId: "choose-n-item",
    selectedOptionIds: selectedOptions,
    valid: true,
  }

  const userAnswer: UserAnswer = {
    version: "4",
    itemAnswers: [userItemAnswer],
  }

  return {
    grading_update_url: "example",
    exercise_spec: privateSpecQuiz,
    submission_data: userAnswer,
  }
}

export function generateTimelineGradingRequest(
  timelineItems: {
    id: string
    year: string
    correctEventName: string
    correctEventId: string
  }[],
  timelineChoices: { timelineItemId: string; chosenEventId: string }[],
) {
  const privateSpecQuiz: PrivateSpecQuiz = {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [
      {
        type: "timeline",
        id: "timeline-item",
        order: 0,
        timelineItems,
        title: "Timeline Test",
        feedbackMessages: [],
      },
    ],
    title: "Timeline Quiz",
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: [],
  }

  const userItemAnswer = {
    type: "timeline" as const,
    quizItemId: "timeline-item",
    timelineChoices,
    valid: true,
  }

  const userAnswer: UserAnswer = {
    version: "4",
    itemAnswers: [userItemAnswer],
  }

  return {
    grading_update_url: "example",
    exercise_spec: privateSpecQuiz,
    submission_data: userAnswer,
  }
}

export function generateUnknownItemTypeGradingRequest() {
  const privateSpecQuiz: PrivateSpecQuiz = {
    version: "4",
    awardPointsEvenIfWrong: false,
    grantPointsPolicy: "grant_whenever_possible",
    items: [
      {
        type: "multiple-choice",
        id: "test-item",
        order: 0,
        shuffleOptions: false,
        allowSelectingMultipleOptions: false,
        options: [
          {
            id: "option-1",
            order: 0,
            correct: true,
            title: "Correct Option",
            body: null,
            feedbackMessages: [],
          },
        ],
        title: "Test Item",
        body: null,
        feedbackMessages: [],
        optionDisplayDirection: "vertical",
        multipleChoiceMultipleOptionsGradingPolicy: "default",
        fogOfWar: false,
      },
    ],
    title: "Test Quiz",
    body: null,
    quizItemDisplayDirection: "vertical",
    feedbackMessages: [],
  }

  // Create a user answer with an unknown type to test error handling
  const userItemAnswer = {
    type: "unknown-type",
    quizItemId: "test-item",
    selectedOptionIds: ["option-1"],
  }

  const userAnswer = {
    version: "4",
    itemAnswers: [userItemAnswer],
  } as UserAnswer

  return {
    grading_update_url: "example",
    exercise_spec: privateSpecQuiz,
    submission_data: userAnswer,
  }
}
