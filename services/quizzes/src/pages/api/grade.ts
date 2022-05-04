/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from "next"

import { Quiz, QuizAnswer, QuizItem, QuizItemAnswer } from "../../../types/types"
import { ExerciseTaskGradingResult } from "../../shared-module/bindings"

interface QuizzesGradingRequest {
  exercise_spec: Quiz
  submission_data: QuizAnswer
}

interface OptionAnswerFeedback {
  option_id: string | null
  option_feedback: string | null
  this_option_was_correct: boolean | null
}

export interface ItemAnswerFeedback {
  quiz_item_id: string | null
  quiz_item_feedback: string | null
  quiz_item_correct: boolean | null
  quiz_item_option_feedbacks: OptionAnswerFeedback[] | null
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
  return res.status(200).json({
    feedback_json: feedbacks,
    feedback_text: exercise_spec.submitMessage,
    grading_progress: "FullyGraded",
    score_given: score,
    score_maximum: exercise_spec.items.length,
  })
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
      return assesMultipleChoiceQuizzes(ia, item)
    } else if (item.type === "open") {
      return assessOpenQuiz(ia, item)
    } else if (item.type === "matrix") {
      return assessMatrixQuiz(ia, item)
    } else if (item.type === "timeline") {
      return assessTimelineQuiz(ia, item)
    } else {
      return { quizItemId: item.id, correct: true, correctnessCoefficient: 1 }
    }
  })
  return result
}

function removeNonPrintingCharacters(string: string): string {
  const nonPrintingCharRegex =
    // eslint-disable-next-line no-misleading-character-class, no-control-regex
    /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g
  return string.replace(nonPrintingCharRegex, "")
}

function assessOpenQuiz(quizItemAnswer: QuizItemAnswer, quizItem: QuizItem): QuizItemAnswerGrading {
  const textData = removeNonPrintingCharacters(
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
  quizItem.timelineItems?.forEach((ti) => {
    const answer = quizItemAnswer.timelineChoices?.find((tc) => tc.year === ti.year)
    if (!answer) {
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
    correct: correctnessCoefficient === 0 ? false : true,
    correctnessCoefficient,
  }
}

function assesMultipleChoiceQuizzes(
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

  // Check if user selected correct amount of options
  const selectedAllCorrectOptions =
    quizItemAnswer.optionAnswers.length === quizItem.options.filter((o) => o.correct).length
  const correct = quizItem.multi
    ? selectedAllCorrectOptions && allSelectedOptionsAreCorrect
    : allSelectedOptionsAreCorrect

  return {
    quizItemId: quizItem.id,
    correct,
    correctnessCoefficient: correct ? 1 : 0,
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
      }
    }
    if (
      item.type === "multiple-choice" ||
      item.type === "clickable-multiple-choice" ||
      item.type === "multiple-choice-dropdown"
    ) {
      return {
        quiz_item_id: item.id,
        quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
        quiz_item_correct: itemGrading.correct,
        quiz_item_option_feedbacks: ia.optionAnswers
          ? ia.optionAnswers.map((oa): OptionAnswerFeedback => {
              const option = item.options.find((o) => o.id === oa) || null
              if (!option) {
                return { option_id: null, option_feedback: null, this_option_was_correct: null }
              }
              return {
                option_id: option.id,
                option_feedback: option.correct ? option.successMessage : option.failureMessage,
                // We'll reveal whether what the student chose was correct or not. If this is not desirable in the future, we can add a configurable policy for this.
                this_option_was_correct: option.correct,
              }
            })
          : null,
      }
    } else {
      return {
        quiz_item_id: item.id,
        quiz_item_feedback: itemGrading.correct ? item.successMessage : item.failureMessage,
        quiz_item_correct: itemGrading.correct,
        quiz_item_option_feedbacks: null,
      }
    }
  })
  return feedbacks
}
