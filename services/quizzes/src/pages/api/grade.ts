/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from "next"

import { Quiz, QuizAnswer, QuizItem, QuizItemAnswer } from "../../../types/types"
import { ExerciseTaskGradingResult } from "../../shared-module/bindings"
import { GradingRequest } from "../../shared-module/exercise-service-protocol-types-2"
import { nullIfEmptyString, stripNonPrintableCharacters } from "../../shared-module/utils/strings"

type QuizzesGradingRequest = GradingRequest<Quiz, QuizAnswer>

interface OptionAnswerFeedback {
  option_id: string | null
  option_feedback: string | null
  this_option_was_correct: boolean | null
}

interface TimelineItemFeedback {
  timeline_item_id: string | null
  what_was_chosen_was_correct: boolean
}

export interface ItemAnswerFeedback {
  quiz_item_id: string | null
  quiz_item_feedback: string | null
  quiz_item_correct: boolean | null
  quiz_item_option_feedbacks: OptionAnswerFeedback[] | null
  timeline_item_feedbacks: TimelineItemFeedback[] | null
}

interface QuizItemAnswerGrading {
  quizItemId: string
  correct: boolean
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 > x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
}

export default (req: NextApiRequest, res: NextApiResponse): void => {
  try {
    if (req.method !== "POST") {
      return res.status(404).json({ message: "Not found" })
    }

    return handlePost(req, res)
  } catch (e) {
    console.error("Grading request failed", e)
    if (e instanceof Error) {
      return res
        .status(500)
        .json({ error_name: e.name, error_message: e.message, error_stack: e.stack })
    } else {
      return res.status(500).json({ error: e })
    }
  }
}

const handlePost = (req: NextApiRequest, res: NextApiResponse<ExerciseTaskGradingResult>) => {
  const gradingRedquest: QuizzesGradingRequest = req.body
  const { exercise_spec, submission_data } = gradingRedquest

  const assessedAnswers = assessAnswers(submission_data, exercise_spec)

  const score = gradeAnswer(assessedAnswers, exercise_spec)
  const feedbacks: ItemAnswerFeedback[] = submissionFeedback(
    submission_data,
    exercise_spec,
    assessedAnswers,
  )
  const responseJson: ExerciseTaskGradingResult = {
    feedback_json: feedbacks,
    feedback_text: nullIfEmptyString(exercise_spec.submitMessage),
    grading_progress: "FullyGraded",
    score_given: score,
    score_maximum: exercise_spec.items.length,
  }
  console.group("Graded submission")
  console.info("Grading request", JSON.stringify(req.body))
  console.info("Grading response", JSON.stringify(responseJson))
  console.groupEnd()
  return res.status(200).json(responseJson)
}

// When grading answers we assume all items have same amount of points
// eg. quizzes which have max points 4 and 2 quiz items both items are worth 2 points
// quiz item is either correct or incorrect
function gradeAnswer(assessedAnswer: QuizItemAnswerGrading[], quiz: Quiz): number {
  // for now all quiz items are worth 1 point
  const maxPoints = quiz.items.length
  if (quiz.awardPointsEvenIfWrong) {
    return maxPoints
  }
  let points = 0
  quiz.items.forEach((item) => {
    const answerForItem = assessedAnswer.find((ia) => ia.quizItemId === item.id)
    if (!answerForItem) {
      // item not answered, 0 points from this quiz item
      return
    }
    let correctnessCoefficient = answerForItem.correctnessCoefficient
    if (correctnessCoefficient > 1) {
      correctnessCoefficient = 1
    }
    if (correctnessCoefficient < 0) {
      correctnessCoefficient = 0
    }
    // Since each item is worth 1 point for now, we can just use adition instead of multiplying the coefficient by 1
    points += correctnessCoefficient
  })

  return points
}

// Function, which goes through every quizItemAnswer and either marks it correct or incorrect
// Different quizItems have special functions which asseses them
// Returns a list of object, which tells whether answer was correct or not
function assessAnswers(quizAnswer: QuizAnswer, quiz: Quiz): QuizItemAnswerGrading[] {
  const result = quizAnswer.itemAnswers.map((ia) => {
    const item = quiz.items.find((i) => i.id === ia.quizItemId)
    if (!item) {
      throw new Error("Item missing")
    }
    if (
      item.type === "multiple-choice" ||
      item.type === "clickable-multiple-choice" ||
      item.type === "multiple-choice-dropdown"
    ) {
      return assessMultipleChoiceQuizzes(ia, item)
    } else if (item.type === "open") {
      return assessOpenQuiz(ia, item)
    } else if (item.type === "matrix") {
      return assessMatrixQuiz(ia, item)
    } else if (item.type === "timeline") {
      return assessTimelineQuiz(ia, item)
    } else {
      // TODO: handle essay word limits
      return { quizItemId: item.id, correct: true, correctnessCoefficient: 1 }
    }
  })
  return result
}

function assessOpenQuiz(quizItemAnswer: QuizItemAnswer, quizItem: QuizItem): QuizItemAnswerGrading {
  const textData = stripNonPrintableCharacters(
    quizItemAnswer.textData ? quizItemAnswer.textData : "",
  )
    .replace(/\0/g, "")
    .trim()
  if (!textData) {
    throw new Error("no answer provided")
  }
  const validityRegex = quizItem.validityRegex ? quizItem.validityRegex.trim() : ""
  const validator = new RegExp(validityRegex, "i")
  const correct = validator.test(textData)
  return { quizItemId: quizItem.id, correct, correctnessCoefficient: correct ? 1 : 0 }
}

function assessTimelineQuiz(
  quizItemAnswer: QuizItemAnswer,
  quizItem: QuizItem,
): QuizItemAnswerGrading {
  let nCorrect = 0
  if (!quizItem.timelineItems) {
    throw new Error("No timeline items for timeline assignment")
  }
  const timeLineItemsCount = quizItem.timelineItems.length
  quizItem.timelineItems?.forEach((ti) => {
    const answer = quizItemAnswer.timelineChoices?.find((tc) => tc.timelineItemId === ti.id)
    if (!answer) {
      console.warn("Could not find an answer for timeline item", ti)
      // No answer, so no points
      return
    }
    if (answer.chosenEventId === ti.correctEventId) {
      nCorrect += 1
    }
  })
  const correctnessCoefficient = nCorrect / quizItem.timelineItems.length
  return {
    quizItemId: quizItem.id,
    correct: nCorrect === timeLineItemsCount,
    correctnessCoefficient,
  }
}

/**
 * Calculate correctness coefficient according to grading method
 *
 * @param quizItemAnswer Quiz Item Answer
 * @param quizItem Quiz Item
 * @returns Percentage of correct answers (correctness coefficient)
 */
function getMultipleChoicePointsByGrading(
  quizItemAnswer: QuizItemAnswer,
  quizItem: QuizItem,
): number {
  let countOfCorrectAnswers = 0
  let countOfIncorrectAnswers = 0

  if (!quizItemAnswer.optionAnswers) {
    return 0
  }

  const totalCorrectAnswers = quizItem.options.filter((o) => o.correct).length
  quizItemAnswer.optionAnswers?.forEach((oa) => {
    const option = quizItem.options.find((o) => o.id === oa)
    if (option && option.correct) {
      countOfCorrectAnswers++
    } else {
      countOfIncorrectAnswers++
    }
  })

  let totalScore = 0
  switch (quizItem.multipleChoiceGradingPolicy) {
    case "default":
      totalScore =
        countOfCorrectAnswers == totalCorrectAnswers && countOfIncorrectAnswers == 0
          ? totalCorrectAnswers
          : 0
      break
    case "points-off-incorrect-options":
      totalScore = Math.max(0, countOfCorrectAnswers - countOfIncorrectAnswers)
      break
    case "points-off-unselected-options":
      totalScore = Math.max(
        0,
        countOfCorrectAnswers * 2 - totalCorrectAnswers - countOfIncorrectAnswers,
      )
      break
  }

  return totalScore / totalCorrectAnswers
}

function assessMultipleChoiceQuizzes(
  quizItemAnswer: QuizItemAnswer,
  quizItem: QuizItem,
): QuizItemAnswerGrading {
  // Throws an error if no option answers
  if (!quizItemAnswer.optionAnswers || quizItemAnswer.optionAnswers.length === 0) {
    throw new Error("No option answers")
  }

  // quizItem.multi tells that student can select many options and there are one or several correct options
  // This is to prevent that if user somehow passes more optionAnswers then allowed
  if (!quizItem.multi && quizItemAnswer.optionAnswers.length > 1) {
    throw new Error("Cannot select multiple answer options on this quiz item")
  }

  // Check if every selected option was a correct answer
  const allSelectedOptionsAreCorrect = quizItemAnswer.optionAnswers.every((oa) => {
    const option = quizItem.options.find((o) => o.id === oa)
    if (option && option.correct) {
      return true
    }
    return false
  })

  const correctnessCoefficient = getMultipleChoicePointsByGrading(quizItemAnswer, quizItem)

  // Check if user selected correct amount of options
  const selectedAllCorrectOptions =
    quizItemAnswer.optionAnswers.length === quizItem.options.filter((o) => o.correct).length
  const correct = quizItem.multi
    ? selectedAllCorrectOptions && allSelectedOptionsAreCorrect
    : allSelectedOptionsAreCorrect

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient,
  }
}

function assessMatrixQuiz(
  quizItemAnswer: QuizItemAnswer,
  quizItem: QuizItem,
): QuizItemAnswerGrading {
  const studentAnswers = quizItemAnswer.optionCells
  const correctAnswers = quizItem.optionCells

  if (!studentAnswers) {
    throw new Error("No student answers")
  }

  if (!correctAnswers) {
    throw new Error("No correct answers")
  }

  const isMatrixCorrect: boolean[] = []
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      isMatrixCorrect.push(correctAnswers[i][j] === studentAnswers[i][j])
    }
  }

  const correct = !isMatrixCorrect.includes(false)

  return { quizItemId: quizItem.id, correct, correctnessCoefficient: correct ? 1 : 0 }
}

function submissionFeedback(
  submission: QuizAnswer,
  quiz: Quiz,
  quizItemgradings: QuizItemAnswerGrading[],
): ItemAnswerFeedback[] {
  const feedbacks: ItemAnswerFeedback[] = submission.itemAnswers.map((ia) => {
    const item = quiz.items.find((i) => i.id === ia.quizItemId)
    const itemGrading = quizItemgradings.find((ig) => ig.quizItemId === ia.quizItemId)
    if (!item || !itemGrading) {
      return {
        quiz_item_id: null,
        quiz_item_feedback: null,
        quiz_item_option_feedbacks: null,
        quiz_item_correct: null,
        timeline_item_feedbacks: null,
      }
    }
    if (
      item.type === "multiple-choice" ||
      item.type === "clickable-multiple-choice" ||
      item.type === "multiple-choice-dropdown"
    ) {
      return {
        timeline_item_feedbacks: null,
        quiz_item_id: item.id,
        quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
        quiz_item_correct: itemGrading.correct,
        quiz_item_option_feedbacks: ia.optionAnswers
          ? ia.optionAnswers.map((oa): OptionAnswerFeedback => {
              const option = item.options.find((o) => o.id === oa) || null
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
            })
          : null,
      }
    }

    if (item.type === "timeline") {
      return {
        quiz_item_id: item.id,
        quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
        quiz_item_correct: itemGrading.correct,
        quiz_item_option_feedbacks: null,
        timeline_item_feedbacks: ia.timelineChoices
          ? ia.timelineChoices.map<TimelineItemFeedback>((tc) => {
              const timelineItem = item.timelineItems?.find((ti) => ti.id === tc.timelineItemId)
              if (!timelineItem) {
                return {
                  timeline_item_id: null,
                  what_was_chosen_was_correct: false,
                }
              }
              return {
                timeline_item_id: timelineItem.id,
                what_was_chosen_was_correct: timelineItem.correctEventId === tc.chosenEventId,
              }
            })
          : null,
      }
    }
    return {
      quiz_item_id: item.id,
      quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
      quiz_item_correct: itemGrading.correct,
      quiz_item_option_feedbacks: null,
      timeline_item_feedbacks: null,
    }
  })
  return feedbacks
}
