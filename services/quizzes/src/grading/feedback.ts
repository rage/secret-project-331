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
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemTimeline,
} from "../../types/quizTypes/privateSpec"

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
          quiz_item_option_feedbacks: null,
          timeline_item_feedbacks: null,
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
            quiz_item_option_feedbacks: null,
            timeline_item_feedbacks: null,
            correctnessCoefficient: 1,
          }
        }

        const fogOfWar = (item as PrivateSpecQuizItemMultiplechoice).fogOfWar === true

        return {
          timeline_item_feedbacks: null,
          quiz_item_id: multipleChoiceQuizItem.id,
          quiz_item_feedback: quizItemFeedback,
          correctnessCoefficient: itemGrading.correctnessCoefficient,
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
          quiz_item_option_feedbacks: null,
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

      return {
        quiz_item_id: item.id,
        quiz_item_feedback: quizItemFeedback,
        quiz_item_option_feedbacks: null,
        timeline_item_feedbacks: null,
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
      quiz_item_option_feedbacks: null,
      timeline_item_feedbacks: null,
      correctnessCoefficient: 1,
    })
  }

  return itemFeedbacks
}

export { submissionFeedback }
