import { applicableItemFeedbackMessages, joinFeedbackMessages } from "@/util/feedbackMessages"

import type {
  UserAnswer,
  UserItemAnswerMultiplechoice,
  UserItemAnswerTimeline,
} from "../../types/quizTypes/answer"
import type {
  ItemAnswerFeedback,
  OptionAnswerFeedback,
  QuizItemAnswerGrading,
  TimelineItemFeedback,
} from "../../types/quizTypes/grading"
import type {
  PrivateSpecQuiz,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemTimeline,
} from "../../types/quizTypes/privateSpec"

/** Collapses the coefficient to wrong/partial/fully-correct when fog of war is on, leaves it exact otherwise. */
const applyFogOfWar = (correctnessCoefficient: number, fogOfWar: boolean): number => {
  if (!fogOfWar) {
    return correctnessCoefficient
  }
  if (correctnessCoefficient <= 0) {
    return 0
  }
  return correctnessCoefficient >= 1 ? 1 : 0.5
}

/** Item-type-specific fields; each branch overrides only its own. */
const NO_TYPE_SPECIFIC_FEEDBACK = {
  quiz_item_option_feedbacks: null,
  timeline_item_feedbacks: null,
  matrix_cell_feedbacks: null,
  matrix_score_breakdown: null,
}

const submissionFeedback = (
  submission: UserAnswer,
  quiz: PrivateSpecQuiz,
  quizItemGradings: QuizItemAnswerGrading[],
  overallCorrectnessRatio: number,
): ItemAnswerFeedback[] => {
  const itemFeedbacks: ItemAnswerFeedback[] = submission.itemAnswers.map(
    (itemAnswer): ItemAnswerFeedback => {
      const item = quiz.items.find((i) => i.id === itemAnswer.quizItemId)
      const itemGrading = quizItemGradings.find((ig) => ig.quizItemId === itemAnswer.quizItemId)

      if (!item || !itemGrading) {
        return {
          quiz_item_id: null,
          quiz_item_feedback: null,
          ...NO_TYPE_SPECIFIC_FEEDBACK,
          correctnessCoefficient: 1,
        }
      }

      const quizItemFeedback = joinFeedbackMessages(
        applicableItemFeedbackMessages(item.feedbackMessages, itemGrading.correctnessCoefficient),
      )

      // Multiple choices
      if (
        item.type === "multiple-choice" ||
        item.type === "multiple-choice-dropdown" ||
        item.type === "choose-n"
      ) {
        const multipleChoiceQuizItem = item as PrivateSpecQuizItemMultiplechoice
        const multipleChoiceUserAnswer = itemAnswer as UserItemAnswerMultiplechoice

        if (!multipleChoiceUserAnswer.selectedOptionIds) {
          return {
            quiz_item_id: null,
            quiz_item_feedback: null,
            ...NO_TYPE_SPECIFIC_FEEDBACK,
            correctnessCoefficient: 1,
          }
        }

        const fogOfWar = (item as PrivateSpecQuizItemMultiplechoice).fogOfWar === true
        // Under partial credit the exact coefficient would reveal which selections changed.
        const correctnessCoefficient = applyFogOfWar(itemGrading.correctnessCoefficient, fogOfWar)

        return {
          ...NO_TYPE_SPECIFIC_FEEDBACK,
          quiz_item_id: multipleChoiceQuizItem.id,
          quiz_item_feedback: quizItemFeedback,
          correctnessCoefficient,
          quiz_item_option_feedbacks: multipleChoiceUserAnswer.selectedOptionIds.map(
            (optionId): OptionAnswerFeedback => {
              const option =
                multipleChoiceQuizItem.options.find((candidate) => candidate.id === optionId) ||
                null

              if (!option) {
                return {
                  option_id: null,
                  option_feedback: null,
                  this_option_was_correct: null,
                }
              }

              return {
                option_id: option.id,
                option_feedback: joinFeedbackMessages(
                  option.feedbackMessages
                    .filter((m) => m.visibility === "when-selected-after-answer")
                    .map((m) => m.message),
                ),
                // We'll reveal whether what the student chose was correct or not. If fogOfWar is turned on, we'll never reveal this in the grading and the student will have to get this information from the model solution spec.
                this_option_was_correct: fogOfWar ? null : option.correct,
              }
            },
          ),
        }
      }

      // Timeline
      if (item.type === "timeline") {
        const timelineQuizItem = item as PrivateSpecQuizItemTimeline
        const timelineItemAnswer = itemAnswer as UserItemAnswerTimeline

        return {
          quiz_item_id: timelineQuizItem.id,
          quiz_item_feedback: quizItemFeedback,
          ...NO_TYPE_SPECIFIC_FEEDBACK,
          correctnessCoefficient: itemGrading.correctnessCoefficient,
          timeline_item_feedbacks: timelineItemAnswer.timelineChoices.map<TimelineItemFeedback>(
            (timelineChoice) => {
              const timelineItem = timelineQuizItem.timelineItems?.find(
                (candidate) => candidate.id === timelineChoice.timelineItemId,
              )
              if (!timelineItem) {
                return {
                  timeline_item_id: null,
                  what_was_chosen_was_correct: false,
                }
              }
              return {
                timeline_item_id: timelineChoice.timelineItemId,
                what_was_chosen_was_correct:
                  timelineItem.correctEventId === timelineChoice.chosenEventId,
              }
            },
          ),
        }
      }

      if (item.type === "matrix") {
        const matrixQuizItem = item as PrivateSpecQuizItemMatrix
        // Null only if grading this item failed.
        const difference = itemGrading.matrixDifference
        // Fog of war withholds per-cell verdicts; the grader already forces it to all-or-nothing.
        const revealCells = !matrixQuizItem.fogOfWar

        return {
          quiz_item_id: matrixQuizItem.id,
          quiz_item_feedback: quizItemFeedback,
          ...NO_TYPE_SPECIFIC_FEEDBACK,
          matrix_cell_feedbacks: revealCells ? (difference?.cellFeedbacks ?? null) : null,
          matrix_score_breakdown: revealCells ? (difference?.breakdown ?? null) : null,
          correctnessCoefficient: itemGrading.correctnessCoefficient,
        }
      }

      return {
        quiz_item_id: item.id,
        quiz_item_feedback: quizItemFeedback,
        ...NO_TYPE_SPECIFIC_FEEDBACK,
        correctnessCoefficient: itemGrading.correctnessCoefficient,
      }
    },
  )

  const quizLevelFeedback = joinFeedbackMessages(
    applicableItemFeedbackMessages(quiz.feedbackMessages, overallCorrectnessRatio),
  )
  if (quizLevelFeedback !== null) {
    itemFeedbacks.push({
      quiz_item_id: null,
      quiz_item_feedback: quizLevelFeedback,
      ...NO_TYPE_SPECIFIC_FEEDBACK,
      correctnessCoefficient: 1,
    })
  }

  return itemFeedbacks
}

export { submissionFeedback }
