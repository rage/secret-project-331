import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  UserAnswer,
  UserItemAnswerCheckbox,
  UserItemAnswerChooseN,
  UserItemAnswerClosedEndedQuestion,
  UserItemAnswerEssay,
  UserItemAnswerMatrix,
  UserItemAnswerMultiplechoice,
  UserItemAnswerMultiplechoiceDropdown,
  UserItemAnswerScale,
  UserItemAnswerTimeline,
} from "../../types/quizTypes/answer"
import { ModelSolutionQuiz } from "../../types/quizTypes/modelSolutionSpec"
import { QuizItemType } from "../../types/quizTypes/privateSpec"
import {
  PublicSpecQuiz,
  PublicSpecQuizItemCheckbox,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemEssay,
  PublicSpecQuizItemMatrix,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemScale,
  PublicSpecQuizItemTimeline,
} from "../../types/quizTypes/publicSpec"
import { ItemAnswerFeedback } from "../grading/feedback"
import { UserInformation } from "../shared-module/exercise-service-protocol-types"
import { baseTheme } from "../shared-module/styles"
import { COLUMN } from "../util/constants"
import { FlexDirection, sanitizeFlexDirection } from "../util/css-sanitization"

import FlexWrapper from "./FlexWrapper"
import CheckBoxFeedback from "./SubmissionComponents/Checkbox"
import EssayFeedback from "./SubmissionComponents/Essay"
import MatrixSubmission from "./SubmissionComponents/Matrix"
import MultipleChoiceSubmission from "./SubmissionComponents/MultipleChoice"
import MultipleChoiceClickableFeedback from "./SubmissionComponents/MultipleChoiceClickable"
import MultipleChoiceDropdownFeedback from "./SubmissionComponents/MultipleChoiceDropdown"
import OpenFeedback from "./SubmissionComponents/Open"
import ScaleSubmissionViewComponent from "./SubmissionComponents/Scale"
import Timeline from "./SubmissionComponents/Timeline"
import Unsupported from "./SubmissionComponents/Unsupported"

interface SubmissionProps {
  user_answer: UserAnswer
  publicAlternatives: PublicSpecQuiz
  modelSolutions: ModelSolutionQuiz | null
  gradingFeedbackJson: ItemAnswerFeedback[] | null
  user_information: UserInformation
}

interface QuizItemSubmissionComponentDescriptor {
  component:
    | typeof EssayFeedback
    | typeof MultipleChoiceSubmission
    | typeof CheckBoxFeedback
    | typeof ScaleSubmissionViewComponent
    | typeof OpenFeedback
    | typeof Unsupported
    | typeof MultipleChoiceDropdownFeedback
    | typeof MultipleChoiceClickableFeedback
    | typeof MatrixSubmission
    | typeof Timeline
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
  "closed-ended-question": {
    component: OpenFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
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

const FlexItem = styled.div`
  flex: 1;
`

const Submission: React.FC<React.PropsWithChildren<SubmissionProps>> = ({
  publicAlternatives,
  modelSolutions,
  gradingFeedbackJson: feedback_json,
  user_answer,
  user_information,
}) => {
  const { t } = useTranslation()

  const mapScoreToFeedback = (score: number) => {
    if (score <= 0) {
      return t("your-answer-was-not-correct")
    } else if (score < 1) {
      return t("your-answer-was-partially-correct")
    } else {
      return t("your-answer-was-correct")
    }
  }

  // set wide screen direction to row if there is multiple-choice item
  // in quiz items
  let direction: FlexDirection = COLUMN
  publicAlternatives.items.every((item) => {
    if (item.type == "multiple-choice") {
      direction = sanitizeFlexDirection(item.optionDisplayDirection, COLUMN)
      return
    }
  })

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {publicAlternatives.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((item) => {
          const componentDescriptor = componentDescriptorByTypeName(item.type as QuizItemType)
          if (!componentDescriptor) {
            return <div key={item.id}>{t("quiz-type-not-supported")}</div>
          }
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
          const feedback = itemFeedback &&
            componentDescriptor.shouldDisplayCorrectnessMessageAfterAnswer && (
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
                {mapScoreToFeedback(itemFeedback.score)}
              </div>
            )
          const missingQuizItemAnswer = !quizItemAnswer && (
            <div
              className={css`
                padding: 1rem;
                background-color: ${baseTheme.colors.gray[100]};
              `}
            >
              {t("error-quiz-item-added-after-answering")}
            </div>
          )
          switch (item.type) {
            case "checkbox":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <CheckBoxFeedback
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemCheckbox}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerCheckbox}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "choose-n":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <MultipleChoiceClickableFeedback
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemChooseN}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerChooseN}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "closed-ended-question":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <OpenFeedback
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemClosedEndedQuestion}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerClosedEndedQuestion}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "essay":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <EssayFeedback
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemEssay}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerEssay}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "matrix":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <MatrixSubmission
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemMatrix}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerMatrix}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "multiple-choice":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <MultipleChoiceSubmission
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemMultiplechoice}
                      quiz_direction={sanitizeFlexDirection(item.optionDisplayDirection, COLUMN)}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerMultiplechoice}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "multiple-choice-dropdown":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <MultipleChoiceDropdownFeedback
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemMultiplechoiceDropdown}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerMultiplechoiceDropdown}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "scale":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <ScaleSubmissionViewComponent
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemScale}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerScale}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
            case "timeline":
              return (
                quizItemAnswer && (
                  <FlexItem key={item.id}>
                    <Timeline
                      key={item.id}
                      public_quiz_item={item as PublicSpecQuizItemTimeline}
                      quiz_direction={direction}
                      quiz_item_feedback={itemFeedback}
                      quiz_item_model_solution={itemModelSolution}
                      user_quiz_item_answer={quizItemAnswer as UserItemAnswerTimeline}
                      user_information={user_information}
                    />
                    {feedback}
                    {missingQuizItemAnswer}
                  </FlexItem>
                )
              )
          }
        })}
    </FlexWrapper>
  )
}

export default Submission
