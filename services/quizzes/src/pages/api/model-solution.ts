import { NextApiRequest, NextApiResponse } from "next"

import {
  Quiz,
  QuizAnswer,
  QuizItemAnswer,
  QuizItemModelSolution,
  UserQuizState,
} from "../../types/types"

interface QuizzesModelSolutionReg {
  quiz: Quiz
  quizAnswer: QuizAnswer
  userQuizState: UserQuizState
}

export default (req: NextApiRequest, res: NextApiResponse): void => {
  const { quiz, quizAnswer, userQuizState }: QuizzesModelSolutionReg = req.body
  if (!quiz.triesLimited) {
    if (userQuizState.tries >= quiz.tries) {
      return res.status(200).json({ msg: "no more tries left", model_solution: {} })
    }
    if (allItemsCorrect(quizAnswer.itemAnswers)) {
      return res
        .status(200)
        .json({ msg: "All answers correct", model_solution: createModelSolution(quiz, quizAnswer) })
    } else {
      return res.status(200).json({ msg: "Some answers were incorrect", model_solution: {} })
    }
  }
  return res.status(200).json({ model_solution: {} })
}

function allItemsCorrect(itemAnswers: QuizItemAnswer[]): boolean {
  return !itemAnswers.map((item) => item.correct).includes(false)
}

function createModelSolution(quiz: Quiz, quizAnswer: QuizAnswer): QuizItemModelSolution[] {
  const modelSolution = quizAnswer.itemAnswers.map((ia) => {
    const quizItem = quiz.items.filter((i) => i.id === ia.quizItemId)[0]
    if (
      quizItem.type ===
      ("multiple-choice" || "multiple-choice-clickable" || "multiple-choice-dropdown")
    ) {
      return {
        quizItemId: ia.id,
        options: ia.optionAnswers?.map((oa) => {
          const option = quizItem.options.filter((o) => o.id === oa)[0]
          if (option.correct) {
            return {
              optionId: option.id,
              successMessage: option.successMessage ?? "",
            }
          } else {
            return {
              optionId: option.id,
              failureMessage: option.failureMessage ?? "",
            }
          }
        }),
      }
    } else if (ia.correct) {
      return {
        quizItemId: ia.quizItemId,
        successMessage: quizItem.successMessage ?? "",
      }
    } else {
      return {
        quizItemId: ia.quizItemId,
        failureMessage: quizItem.failureMessage ?? "",
      }
    }
  })

  return modelSolution
}
