import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ModelSolutionQuiz, PublicQuiz, QuizAnswer } from "../../types/types"
import { ItemAnswerFeedback } from "../pages/api/grade"
import { UserInformation } from "../shared-module/exercise-service-protocol-types"
import { baseTheme } from "../shared-module/styles"
import { sanitizeFlexDirection } from "../shared-module/utils/css-sanitization"
import { COLUMN } from "../util/constants"

import FlexWrapper from "./FlexWrapper"
import { QuizItemSubmissionComponentProps } from "./SubmissionComponents"
import CheckBoxFeedback from "./SubmissionComponents/Checkbox"
import EssayFeedback from "./SubmissionComponents/Essay"
import MatrixSubmission from "./SubmissionComponents/Matrix"
import MultipleChoiceSubmission from "./SubmissionComponents/MultipleChoice"
import MultipleChoiceClickableFeedback from "./SubmissionComponents/MultipleChoiceClickable"
import MultipleChoiceDropdownFeedback from "./SubmissionComponents/MultipleChoiceDropdown"
import OpenFeedback from "./SubmissionComponents/Open"
import ScaleSubmissionViewComponent from "./SubmissionComponents/Scale"
import Timeline from "./SubmissionComponents/Timeline"

interface SubmissionProps {
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz | null
  gradingFeedbackJson: ItemAnswerFeedback[] | null
  user_information: UserInformation
}

type QuizScoreState = "incorrect" | "partially-correct" | "correct"

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
  component: React.ComponentClass<QuizItemSubmissionComponentProps>
  shouldDisplayCorrectnessMessageAfterAnswer: boolean
}

const mapTypeToComponent: { [key: string]: QuizItemSubmissionComponentDescriptor } = {
  essay: { component: EssayFeedback, shouldDisplayCorrectnessMessageAfterAnswer: false },
  "multiple-choice": {
    component: MultipleChoiceSubmission,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  checkbox: {
    component: CheckBoxFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  scale: {
    component: ScaleSubmissionViewComponent,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  open: { component: OpenFeedback, shouldDisplayCorrectnessMessageAfterAnswer: true },
  "custom-frontend-accept-data": {
    component: OpenFeedback,
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

/* eslint-disable i18next/no-literal-string */
const getQuizScoreState = (feedback_json: ItemAnswerFeedback[] | null): QuizScoreState => {
  let quizScoreState: QuizScoreState = "incorrect"
  if (feedback_json) {
    const totalScore =
      feedback_json.map((item) => item.score).reduce((a, b) => a + b) / feedback_json.length
    if (totalScore == 1) {
      quizScoreState = "correct"
    } else if (totalScore > 0 && totalScore < 1) {
      quizScoreState = "partially-correct"
    } else {
      quizScoreState = "incorrect"
    }
  }
  return quizScoreState
}

const Submission: React.FC<React.PropsWithChildren<SubmissionProps>> = ({
  publicAlternatives,
  modelSolutions,
  gradingFeedbackJson: feedback_json,
  user_answer,
  user_information,
}) => {
  const { t } = useTranslation()
  const quizScoreState: QuizScoreState = getQuizScoreState(feedback_json)

  const direction = sanitizeFlexDirection(publicAlternatives.direction, COLUMN)

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {publicAlternatives.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((item) => {
          const componentDescriptor = componentDescriptorByTypeName(item.type as QuizItemType)
          if (!componentDescriptor) {
            return <div key={item.id}>{t("quiz-type-not-supported")}</div>
          }
          const Component = componentDescriptor.component
          const itemFeedback = feedback_json
            ? feedback_json.filter((itemFeedback) => itemFeedback.quiz_item_id === item.id)[0]
            : null
          const itemModelSolution = modelSolutions
            ? modelSolutions.items.filter(
                (itemModelSolution) => itemModelSolution.id === item.id,
              )[0]
            : null
          const quizItemAnswer = user_answer.itemAnswers.filter(
            (ia) => ia.quizItemId === item.id,
          )[0]
          return (
            <div
              className={css`
                flex: 1;
              `}
              key={item.id}
            >
              {quizItemAnswer && (
                <>
                  <Component
                    key={item.id}
                    public_quiz_item={item}
                    quiz_direction={direction}
                    quiz_item_feedback={itemFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer}
                    user_information={user_information}
                  />
                  {itemFeedback &&
                    componentDescriptor.shouldDisplayCorrectnessMessageAfterAnswer && (
                      <div
                        className={css`
                          background: ${itemFeedback.quiz_item_correct ? "#f1fff2" : "#fff4f5"};
                          border: 1px solid
                            ${itemFeedback.quiz_item_correct ? "#cbf3cd" : "#f3cbcf"};
                          box-sizing: border-box;
                          border-radius: 4px;
                          color: ${itemFeedback.quiz_item_correct ? "#1c850d" : "#d52a3c"};
                          margin: 1.5rem auto;
                          margin-bottom: 0;
                          padding: 0.25rem 1.5rem;
                          width: fit-content;
                        `}
                      >
                        {quizScoreState === "correct" && t("your-answer-was-correct")}
                        {quizScoreState === "partially-correct" &&
                          t("your-answer-was-partially-correct")}
                        {quizScoreState === "incorrect" && t("your-answer-was-not-correct")}
                      </div>
                    )}{" "}
                </>
              )}
              {!quizItemAnswer && (
                <div
                  className={css`
                    padding: 1rem;
                    background-color: ${baseTheme.colors.gray[100]};
                  `}
                >
                  {t("error-quiz-item-added-after-answering")}
                </div>
              )}
            </div>
          )
        })}
    </FlexWrapper>
  )
}

export default Submission
