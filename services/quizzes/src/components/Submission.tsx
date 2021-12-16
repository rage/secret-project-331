import React from "react"

import {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
  PublicQuiz,
  PublicQuizItem,
  QuizAnswer,
  QuizItemAnswer,
} from "../../types/types"
import { ItemAnswerFeedback } from "../pages/api/grade"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

import MultipleChoiceFeedback from "./SubmissionComponents/MultipleChoiceFeedback"
import UnsupportedSubmissionViewComponent from "./SubmissionComponents/Unsupported"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number | null
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz
  feedback_json: ItemAnswerFeedback[] | null
}

export interface QuizItemSubmissionComponentProps {
  public_quiz_item: PublicQuizItem
  quiz_item_model_solution: ModelSolutionQuizItem
  quiz_item_feedback: ItemAnswerFeedback | null
  user_quiz_item_answer: QuizItemAnswer
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
    "multiple-choice": MultipleChoiceFeedback,
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
  user_answer,
}) => {
  return (
    <HeightTrackingContainer port={port}>
      {publicAlternatives.items.map((item) => {
        const Component = componentsByTypeNames(item.type as QuizItemType)
        const itemFeedback = feedback_json
          ? feedback_json.filter((itemFeedback) => itemFeedback.quiz_item_id === item.id)[0]
          : null
        const itemModelSolution = modelSolutions.items.filter(
          (itemModelSolution) => itemModelSolution.id === item.id,
        )[0]
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
    </HeightTrackingContainer>
  )
}

export default Submission
