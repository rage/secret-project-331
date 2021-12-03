import React from "react"

import {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
  PublicQuiz,
  PublicQuizItem,
  QuizAnswer,
} from "../../types/types"
import { ItemAnswerFeedback } from "../pages/api/grade"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

import UnsupportedSubmissionViewComponent from "./SubmissionComponents/Unsupported"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number | null
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz
  feedback_json: ItemAnswerFeedback[]
}

interface QuizItemSubmissionComponentProps {
  public_quiz_item: PublicQuizItem
  quiz_item_model_solution: ModelSolutionQuizItem
  quiz_item_feedback: ItemAnswerFeedback
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
    "multiple-choice": UnsupportedSubmissionViewComponent,
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
  port,
  publicAlternatives,
  modelSolutions,
  feedback_json,
}) => {
  return (
    <HeightTrackingContainer port={port}>
      {publicAlternatives.items.map((item) => {
        const Component = componentsByTypeNames(item.type as QuizItemType)
        const itemFeedback = feedback_json.filter(
          (itemFeedback) => itemFeedback.quiz_item_id === item.id,
        )[0]
        const itemModelSolution = modelSolutions.items.filter(
          (itemModelSolution) => itemModelSolution.id === item.id,
        )[0]
        return (
          <Component
            key={item.id}
            public_quiz_item={item}
            quiz_item_feedback={itemFeedback}
            quiz_item_model_solution={itemModelSolution}
          />
        )
      })}
    </HeightTrackingContainer>
  )
}

export default Submission
