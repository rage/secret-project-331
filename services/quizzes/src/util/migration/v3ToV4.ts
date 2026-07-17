/**
 * v3 -> v4 migration.
 *
 * v4 remodels every feedback-message field into a visibility-tagged array. The old fixed fields each
 * mapped to exactly one visibility, so this is a behavior-preserving reshape:
 *   - item `successMessage`         -> `after-correct-answer`
 *   - item `failureMessage`         -> `after-partially-correct-answer` AND `after-incorrect-answer`
 *     (v3 showed the failure message for both, so it becomes two entries with the same text)
 *   - item `messageOnModelSolution` -> `on-model-solution`
 *   - option `messageAfterSubmissionWhenSelected`               -> `when-selected-after-answer`
 *   - option `additionalCorrectnessExplanationOnModelSolution`  -> `on-model-solution`
 *   - quiz `submitMessage`          -> `after-any-answer`
 * Null/blank sources produce no entry (trimmed). `sharedOptionFeedbackMessage` was dead (no UI,
 * never read) and is dropped. The model solution spec keeps only the on-model-solution strings.
 */
import type { UserAnswer } from "../../../types/quizTypes/answer"
import type {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
  QuizItemOption as ModelSolutionQuizItemOption,
} from "../../../types/quizTypes/modelSolutionSpec"
import type {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  QuizFeedbackMessage,
  QuizItemOption,
  QuizOptionFeedbackMessage,
} from "../../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import type {
  ModelSolutionQuizItemV3,
  ModelSolutionQuizV3,
  PrivateSpecQuizItemV3,
  PrivateSpecQuizV3,
  PublicSpecQuizV3,
  QuizItemOptionV3,
  UserAnswerV3,
} from "../../../types/quizTypes/v3"

const nonEmpty = (message: string | null | undefined): string | null => {
  if (message === null || message === undefined) {
    return null
  }
  const trimmed = message.trim()
  return trimmed === "" ? null : trimmed
}

const itemFeedbackMessages = (item: PrivateSpecQuizItemV3): QuizFeedbackMessage[] => {
  const messages: QuizFeedbackMessage[] = []
  const success = nonEmpty(item.successMessage)
  if (success !== null) {
    messages.push({ visibility: "after-correct-answer", message: success })
  }
  const failure = nonEmpty(item.failureMessage)
  if (failure !== null) {
    // v3 showed the failure message for both partial and incorrect answers.
    messages.push(
      { visibility: "after-partially-correct-answer", message: failure },
      { visibility: "after-incorrect-answer", message: failure },
    )
  }
  const onModelSolution = nonEmpty(item.messageOnModelSolution)
  if (onModelSolution !== null) {
    messages.push({ visibility: "on-model-solution", message: onModelSolution })
  }
  return messages
}

const optionFeedbackMessages = (option: QuizItemOptionV3): QuizOptionFeedbackMessage[] => {
  const messages: QuizOptionFeedbackMessage[] = []
  const whenSelected = nonEmpty(option.messageAfterSubmissionWhenSelected)
  if (whenSelected !== null) {
    messages.push({ visibility: "when-selected-after-answer", message: whenSelected })
  }
  const onModelSolution = nonEmpty(option.additionalCorrectnessExplanationOnModelSolution)
  if (onModelSolution !== null) {
    messages.push({ visibility: "on-model-solution", message: onModelSolution })
  }
  return messages
}

const migrateOption = (option: QuizItemOptionV3): QuizItemOption => ({
  id: option.id,
  order: option.order,
  correct: option.correct,
  title: option.title,
  body: option.body,
  feedbackMessages: optionFeedbackMessages(option),
})

const migratePrivateSpecItem = (item: PrivateSpecQuizItemV3): PrivateSpecQuizItem => {
  const feedbackMessages = itemFeedbackMessages(item)
  switch (item.type) {
    case "multiple-choice":
      return {
        type: "multiple-choice",
        id: item.id,
        order: item.order,
        shuffleOptions: item.shuffleOptions,
        allowSelectingMultipleOptions: item.allowSelectingMultipleOptions,
        fogOfWar: item.fogOfWar,
        options: item.options.map(migrateOption),
        title: item.title,
        body: item.body,
        optionDisplayDirection: item.optionDisplayDirection,
        multipleChoiceMultipleOptionsGradingPolicy: item.multipleChoiceMultipleOptionsGradingPolicy,
        feedbackMessages,
      }
    case "essay":
      return {
        type: "essay",
        id: item.id,
        order: item.order,
        minWords: item.minWords,
        maxWords: item.maxWords,
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    case "scale":
      return {
        type: "scale",
        id: item.id,
        order: item.order,
        maxValue: item.maxValue,
        minValue: item.minValue,
        maxLabel: item.maxLabel,
        minLabel: item.minLabel,
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    case "checkbox":
      return {
        type: "checkbox",
        id: item.id,
        order: item.order,
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    case "closed-ended-question":
      return {
        type: "closed-ended-question",
        id: item.id,
        order: item.order,
        gradingStrategy: item.gradingStrategy,
        formatRegex: item.formatRegex,
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    case "matrix":
      return {
        type: "matrix",
        id: item.id,
        order: item.order,
        ...(item.title !== undefined ? { title: item.title } : {}),
        optionCells: item.optionCells,
        feedbackMessages,
      }
    case "timeline":
      return {
        type: "timeline",
        id: item.id,
        order: item.order,
        ...(item.title !== undefined ? { title: item.title } : {}),
        timelineItems: item.timelineItems,
        feedbackMessages,
      }
    case "choose-n":
      return {
        type: "choose-n",
        id: item.id,
        order: item.order,
        n: item.n,
        options: item.options.map(migrateOption),
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    case "multiple-choice-dropdown":
      return {
        type: "multiple-choice-dropdown",
        id: item.id,
        order: item.order,
        options: item.options.map(migrateOption),
        title: item.title,
        body: item.body,
        feedbackMessages,
      }
    default:
      // Stored blobs are untrusted: fail loud rather than silently emitting undefined items.
      throw new Error(`Unknown quiz item type: '${(item as { type: string }).type}'`)
  }
}

export const migratePrivateSpecV3ToV4 = (quiz: PrivateSpecQuizV3): PrivateSpecQuiz => {
  const feedbackMessages: QuizFeedbackMessage[] = []
  const submit = nonEmpty(quiz.submitMessage)
  if (submit !== null) {
    feedbackMessages.push({ visibility: "after-any-answer", message: submit })
  }
  return {
    version: "4",
    awardPointsEvenIfWrong: quiz.awardPointsEvenIfWrong,
    grantPointsPolicy: quiz.grantPointsPolicy,
    title: quiz.title,
    body: quiz.body,
    quizItemDisplayDirection: quiz.quizItemDisplayDirection,
    items: quiz.items.map(migratePrivateSpecItem),
    feedbackMessages,
  }
}

const modelSolutionMessages = (message: string | null | undefined): string[] => {
  const trimmed = nonEmpty(message)
  return trimmed === null ? [] : [trimmed]
}

const migrateModelSolutionOption = (option: QuizItemOptionV3): ModelSolutionQuizItemOption => ({
  id: option.id,
  order: option.order,
  correct: option.correct,
  title: option.title,
  body: option.body,
  messagesOnModelSolution: modelSolutionMessages(
    option.additionalCorrectnessExplanationOnModelSolution,
  ),
})

const migrateModelSolutionItem = (item: ModelSolutionQuizItemV3): ModelSolutionQuizItem => {
  const messagesOnModelSolution = modelSolutionMessages(item.messageOnModelSolution)
  switch (item.type) {
    case "multiple-choice":
      return {
        type: "multiple-choice",
        id: item.id,
        order: item.order,
        shuffleOptions: item.shuffleOptions,
        allowSelectingMultipleOptions: item.allowSelectingMultipleOptions,
        options: item.options.map(migrateModelSolutionOption),
        title: item.title,
        body: item.body,
        optionDisplayDirection: item.optionDisplayDirection,
        multipleChoiceMultipleOptionsGradingPolicy: item.multipleChoiceMultipleOptionsGradingPolicy,
        messagesOnModelSolution,
      }
    case "essay":
      return {
        type: "essay",
        id: item.id,
        order: item.order,
        minWords: item.minWords,
        maxWords: item.maxWords,
        title: item.title,
        body: item.body,
        messagesOnModelSolution,
      }
    case "scale":
      return {
        type: "scale",
        id: item.id,
        order: item.order,
        maxValue: item.maxValue,
        minValue: item.minValue,
        maxLabel: item.maxLabel,
        minLabel: item.minLabel,
        title: item.title,
        body: item.body,
        messagesOnModelSolution,
      }
    case "checkbox":
      return {
        type: "checkbox",
        id: item.id,
        order: item.order,
        title: item.title,
        body: item.body,
        messagesOnModelSolution,
      }
    case "closed-ended-question":
      return {
        type: "closed-ended-question",
        id: item.id,
        order: item.order,
        formatRegex: item.formatRegex,
        title: item.title,
        body: item.body,
        correctAnswerDisplayTexts: item.correctAnswerDisplayTexts,
        messagesOnModelSolution,
      }
    case "matrix":
      return {
        type: "matrix",
        id: item.id,
        order: item.order,
        optionCells: item.optionCells,
        messagesOnModelSolution,
      }
    case "timeline":
      return {
        type: "timeline",
        id: item.id,
        order: item.order,
        timelineItems: item.timelineItems,
        messagesOnModelSolution,
      }
    case "choose-n":
      return {
        type: "choose-n",
        id: item.id,
        order: item.order,
        n: item.n,
        options: item.options.map(migrateModelSolutionOption),
        title: item.title,
        body: item.body,
        messagesOnModelSolution,
      }
    case "multiple-choice-dropdown":
      return {
        type: "multiple-choice-dropdown",
        id: item.id,
        order: item.order,
        options: item.options.map(migrateModelSolutionOption),
        title: item.title,
        body: item.body,
        messagesOnModelSolution,
      }
    default:
      // Stored blobs are untrusted: fail loud rather than silently emitting undefined items.
      throw new Error(`Unknown quiz item type: '${(item as { type: string }).type}'`)
  }
}

export const migrateModelSolutionV3ToV4 = (quiz: ModelSolutionQuizV3): ModelSolutionQuiz => {
  return {
    version: "4",
    awardPointsEvenIfWrong: quiz.awardPointsEvenIfWrong,
    grantPointsPolicy: quiz.grantPointsPolicy,
    title: quiz.title,
    body: quiz.body,
    items: quiz.items.map(migrateModelSolutionItem),
    // The v3 model-solution submitMessage was never read by any view, so nothing to carry over.
    messagesOnModelSolution: [],
  }
}

export const migratePublicSpecV3ToV4 = (quiz: PublicSpecQuizV3): PublicSpecQuiz => {
  // The public spec carries no feedback, so only the version literal changes.
  return { ...quiz, version: "4" }
}

export const migrateUserAnswerV3ToV4 = (answer: UserAnswerV3): UserAnswer => {
  // The answer shape is structurally unchanged between v3 and v4.
  return { ...answer, version: "4" }
}
