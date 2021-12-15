import React from "react"

import { ModelSolutionQuiz, PublicQuiz, QuizAnswer } from "../../types/types"
import { ItemAnswerFeedback } from "../pages/api/grade"

import { QuizItemSubmissionComponentProps } from "./SubmissionComponents"
import MultipleChoiceSubmission from "./SubmissionComponents/MultipleChoice"
import UnsupportedSubmissionViewComponent from "./SubmissionComponents/Unsupported"

interface SubmissionProps {
  maxWidth: number | null
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz | null
  feedback_json: ItemAnswerFeedback[] | null
}

type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "custom-frontend-accept-data"

const componentsByTypeNames = (typeName: QuizItemType) => {
  const mapTypeToComponent: { [key: string]: React.FC<QuizItemSubmissionComponentProps> } = {
    essay: UnsupportedSubmissionViewComponent,
    "multiple-choice": MultipleChoiceSubmission,
    checkbox: UnsupportedSubmissionViewComponent,
    scale: UnsupportedSubmissionViewComponent,
    open: UnsupportedSubmissionViewComponent,
    "custom-frontend-accept-data": UnsupportedSubmissionViewComponent,
    "multiple-choice-dropdown": UnsupportedSubmissionViewComponent,
    "clickable-multiple-choice": UnsupportedSubmissionViewComponent,
  }

  return mapTypeToComponent[typeName]
}

const Submission: React.FC<SubmissionProps> = ({
  publicAlternatives,
  modelSolutions,
  feedback_json,
  user_answer,
}) => {
  return (
    <>
      {publicAlternatives.items.map((item) => {
        const Component = componentsByTypeNames(item.type as QuizItemType)
        const itemFeedback = feedback_json
          ? feedback_json.filter((itemFeedback) => itemFeedback.quiz_item_id === item.id)[0]
          : null
        const itemModelSolution = modelSolutions
          ? modelSolutions.items.filter((itemModelSolution) => itemModelSolution.id === item.id)[0]
          : null
        const quizItemAnswer = user_answer.itemAnswers.filter((ia) => ia.quizItemId === item.id)[0]
        return (
          <Component
            key={item.id}
            public_quiz_item={item}
            quiz_item_feedback={itemFeedback}
            quiz_item_model_solution={itemModelSolution}
            user_quiz_item_answer={quizItemAnswer}
          />
        )
      })}
    </>
  )
}

export default Submission
