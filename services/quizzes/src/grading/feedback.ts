import {
  UserAnswer,
  UserItemAnswerMultiplechoice,
  UserItemAnswerTimeline,
} from "../../types/quizTypes/answer"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemTimeline,
} from "../../types/quizTypes/privateSpec"

import { QuizItemAnswerGrading } from "./types"

export interface OptionAnswerFeedback {
  option_id: string | null
  option_feedback: string | null
  this_option_was_correct: boolean | null
}

export interface TimelineItemFeedback {
  timeline_item_id: string | null
  what_was_chosen_was_correct: boolean
}

export interface ItemAnswerFeedback {
  quiz_item_id: string | null
  quiz_item_feedback: string | null
  quiz_item_correct: boolean | null
  quiz_item_option_feedbacks: OptionAnswerFeedback[] | null
  timeline_item_feedbacks: TimelineItemFeedback[] | null
  score: number
}

const submissionFeedback = (
  submission: UserAnswer,
  quiz: PrivateSpecQuiz,
  quizItemGradings: QuizItemAnswerGrading[],
): ItemAnswerFeedback[] => {
  return submission.itemAnswers.map((itemAnswer) => {
    const item = quiz.items.find((i) => i.id === itemAnswer.quizItemId)
    const itemGrading = quizItemGradings.find((ig) => ig.quizItemId === itemAnswer.quizItemId)

    if (!item || !itemGrading) {
      return {
        quiz_item_id: null,
        quiz_item_feedback: null,
        quiz_item_option_feedbacks: null,
        quiz_item_correct: null,
        timeline_item_feedbacks: null,
        score: 1,
      }
    }

    // Multiple choices
    if (
      item.type == "multiple-choice" ||
      item.type == "multiple-choice-dropdown" ||
      item.type == "choose-n"
    ) {
      const multipleChoiceQuizItem = item as PrivateSpecQuizItemMultiplechoice
      const multipleChoiceUserAnswer = itemAnswer as UserItemAnswerMultiplechoice

      const quizItemFeedback = itemGrading.correct
        ? multipleChoiceQuizItem.successMessage
        : multipleChoiceQuizItem.failureMessage

      if (!multipleChoiceUserAnswer.selectedOptionIds) {
        return {
          quiz_item_id: null,
          quiz_item_feedback: null,
          quiz_item_option_feedbacks: null,
          quiz_item_correct: null,
          timeline_item_feedbacks: null,
          score: 1,
        }
      }

      return {
        timeline_item_feedbacks: null,
        quiz_item_id: multipleChoiceQuizItem.id,
        quiz_item_correct: itemGrading.correct,
        quiz_item_feedback: quizItemFeedback,
        score: itemGrading.correctnessCoefficient,
        quiz_item_option_feedbacks: multipleChoiceUserAnswer.selectedOptionIds.map(
          (optionId): OptionAnswerFeedback => {
            const option =
              multipleChoiceQuizItem.options.find((option) => option.id === optionId) || null

            if (!option) {
              return {
                option_id: null,
                option_feedback: null,
                this_option_was_correct: null,
              }
            }

            return {
              option_id: option.id,
              option_feedback: option.messageAfterSubmissionWhenSelected,
              // We'll reveal whether what the student chose was correct or not. If this is not desirable in the future, we can add a configurable policy for this.
              this_option_was_correct: option.correct,
            }
          },
        ),
      }
    }

    // Timeline
    if (item.type == "timeline") {
      const timelineQuizItem = item as PrivateSpecQuizItemTimeline
      const timelineItemAnswer = itemAnswer as UserItemAnswerTimeline
      const quizItemFeedback = itemGrading.correct
        ? timelineQuizItem.successMessage
        : timelineQuizItem.failureMessage

      return {
        quiz_item_id: timelineQuizItem.id,
        quiz_item_feedback: quizItemFeedback,
        quiz_item_correct: itemGrading.correct,
        quiz_item_option_feedbacks: null,
        score: itemGrading.correctnessCoefficient,
        timeline_item_feedbacks: timelineItemAnswer.timelineChoices.map<TimelineItemFeedback>(
          (timelineChoice) => {
            const timelineItem = timelineQuizItem.timelineItems?.find(
              (timelineItem) => timelineItem.id == timelineChoice.timelineItemId,
            )
            if (!timelineItem) {
              return {
                timeline_item_id: null,
                what_was_chosen_was_correct: false,
              }
            }
            return {
              timeline_item_id: timelineQuizItem.id,
              what_was_chosen_was_correct:
                timelineItem.correctEventId === timelineChoice.chosenEventId,
            }
          },
        ),
      }
    }

    return {
      quiz_item_id: item.id,
      quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
      quiz_item_correct: itemGrading.correct,
      quiz_item_option_feedbacks: null,
      timeline_item_feedbacks: null,
      score: itemGrading.correctnessCoefficient,
    }
  })
}

export { submissionFeedback }
