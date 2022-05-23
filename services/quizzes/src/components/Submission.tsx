import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ModelSolutionQuiz, PublicQuiz, QuizAnswer } from "../../types/types"
import { ItemAnswerFeedback } from "../pages/api/grade"

import { QuizItemSubmissionComponentProps } from "./SubmissionComponents"
import EssayFeedback from "./SubmissionComponents/Essay"
import MatrixSubmission from "./SubmissionComponents/Matrix"
import MultipleChoiceSubmission from "./SubmissionComponents/MultipleChoice"
import MultipleChoiceClickableFeedback from "./SubmissionComponents/MultipleChoiceClickable"
import MultipleChoiceDropdownFeedback from "./SubmissionComponents/MultipleChoiceDropdown"
import OpenFeedback from "./SubmissionComponents/Open"
import Timeline from "./SubmissionComponents/Timeline"
import UnsupportedSubmissionViewComponent from "./SubmissionComponents/Unsupported"

interface SubmissionProps {
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz | null
  gradingFeedbackJson: ItemAnswerFeedback[] | null
}

type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "custom-frontend-accept-data"
  | "matrix"
  | "timeline"

interface QuizItemSubmissionComponentDescriptor {
  component: React.FC<QuizItemSubmissionComponentProps>
  shouldDisplayCorrectnessMessageAfterAnswer: boolean
}

const mapTypeToComponent: { [key: string]: QuizItemSubmissionComponentDescriptor } = {
  essay: { component: EssayFeedback, shouldDisplayCorrectnessMessageAfterAnswer: false },
  "multiple-choice": {
    component: MultipleChoiceSubmission,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  checkbox: {
    component: UnsupportedSubmissionViewComponent,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  scale: {
    component: UnsupportedSubmissionViewComponent,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  open: { component: OpenFeedback, shouldDisplayCorrectnessMessageAfterAnswer: true },
  "custom-frontend-accept-data": {
    component: UnsupportedSubmissionViewComponent,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  "multiple-choice-dropdown": {
    component: MultipleChoiceDropdownFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  "clickable-multiple-choice": {
    component: MultipleChoiceClickableFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  matrix: { component: MatrixSubmission, shouldDisplayCorrectnessMessageAfterAnswer: true },
  timeline: { component: Timeline, shouldDisplayCorrectnessMessageAfterAnswer: true },
}

const componentDescriptorByTypeName = (
  typeName: QuizItemType,
): QuizItemSubmissionComponentDescriptor | undefined => {
  return mapTypeToComponent[typeName]
}

const Submission: React.FC<SubmissionProps> = ({
  publicAlternatives,
  modelSolutions,
  gradingFeedbackJson: feedback_json,
  user_answer,
}) => {
  const { t } = useTranslation()
  return (
    <>
      {publicAlternatives.items.map((item) => {
        const componentDescriptor = componentDescriptorByTypeName(item.type as QuizItemType)
        if (!componentDescriptor) {
          return <div key={item.id}>{t("quiz-type-not-supported")}</div>
        }
        const Component = componentDescriptor.component
        const itemFeedback = feedback_json
          ? feedback_json.filter((itemFeedback) => itemFeedback.quiz_item_id === item.id)[0]
          : null
        const itemModelSolution = modelSolutions
          ? modelSolutions.items.filter((itemModelSolution) => itemModelSolution.id === item.id)[0]
          : null
        const quizItemAnswer = user_answer.itemAnswers.filter((ia) => ia.quizItemId === item.id)[0]
        return (
          <div key={item.id}>
            <Component
              key={item.id}
              public_quiz_item={item}
              quiz_item_feedback={itemFeedback}
              quiz_item_model_solution={itemModelSolution}
              user_quiz_item_answer={quizItemAnswer}
            />
            {itemFeedback && componentDescriptor.shouldDisplayCorrectnessMessageAfterAnswer && (
              <div
                className={css`
                  background: ${itemFeedback.quiz_item_correct ? "#f1fff2" : "#fff4f5"};
                  border: 1px solid ${itemFeedback.quiz_item_correct ? "#cbf3cd" : "#f3cbcf"};
                  box-sizing: border-box;
                  border-radius: 4px;
                  color: ${itemFeedback.quiz_item_correct ? "#1c850d" : "#d52a3c"};
                  margin: 1.5rem auto;
                  margin-bottom: 0;
                  padding: 0.25rem 1.5rem;
                  width: fit-content;
                `}
              >
                {itemFeedback.quiz_item_correct
                  ? t("your-answer-was-correct")
                  : t("your-answer-was-not-correct")}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export default Submission
