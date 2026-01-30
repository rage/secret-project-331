"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { BullhornMegaphone, InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useCallback, useMemo } from "react"
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
} from "../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../types/quizTypes/grading"
import {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
} from "../../../../types/quizTypes/modelSolutionSpec"
import { QuizItemType } from "../../../../types/quizTypes/privateSpec"
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
} from "../../../../types/quizTypes/publicSpec"
import FlexWrapper from "../../FlexWrapper"
import ParsedText from "../../ParsedText"

import CheckBoxFeedback from "./impl-by-quiz-item-type/Checkbox"
import ChooseN from "./impl-by-quiz-item-type/ChooseN"
import ClosedEndedQuestionFeedback from "./impl-by-quiz-item-type/Closed-ended-question"
import EssayFeedback from "./impl-by-quiz-item-type/Essay"
import MatrixSubmission from "./impl-by-quiz-item-type/Matrix"
import MultipleChoiceSubmission from "./impl-by-quiz-item-type/MultipleChoice"
import MultipleChoiceDropdownFeedback from "./impl-by-quiz-item-type/MultipleChoiceDropdown"
import ScaleSubmissionViewComponent from "./impl-by-quiz-item-type/Scale"
import Timeline from "./impl-by-quiz-item-type/Timeline"
import Unsupported from "./impl-by-quiz-item-type/Unsupported"

import GenericInfobox from "@/shared-module/common/components/GenericInfobox"
import { UserInformation } from "@/shared-module/common/exercise-service-protocol-types"
import { baseTheme } from "@/shared-module/common/styles"
import { COLUMN } from "@/util/constants"
import { FlexDirection, sanitizeFlexDirection } from "@/util/css-sanitization"

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
    | typeof ClosedEndedQuestionFeedback
    | typeof Unsupported
    | typeof MultipleChoiceDropdownFeedback
    | typeof ChooseN
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
    component: ClosedEndedQuestionFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  "custom-frontend-accept-data": {
    component: ClosedEndedQuestionFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: false,
  },
  "multiple-choice-dropdown": {
    component: MultipleChoiceDropdownFeedback,
    shouldDisplayCorrectnessMessageAfterAnswer: true,
  },
  "choose-n": {
    component: ChooseN,
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

const SubmissionFeedback: React.FC<{
  itemFeedback?: ItemAnswerFeedback | null
  itemModelSolution: ModelSolutionQuizItem | null
  questionType: QuizItemType
  submitMessage?: string | null
  showScore?: boolean
}> = ({ itemFeedback, itemModelSolution, questionType, submitMessage, showScore = true }) => {
  const { t } = useTranslation()

  let backgroundColor = "#f5f5f5" // Default grey for unknown
  let textColor = "#292929" // Dark text for better contrast

  const userScore = showScore ? (itemFeedback?.correctnessCoefficient ?? itemFeedback?.score) : null
  if (showScore) {
    if (userScore == 1) {
      backgroundColor = "#e8f5e8"
      textColor = "#292929"
    } else if (userScore == 0) {
      backgroundColor = "#fdeaea"
      textColor = "#292929"
    } else if (userScore !== null && userScore !== undefined) {
      backgroundColor = "#f5f5f5"
      textColor = "#292929"
    }
  }

  const mapScoreToFeedback = useCallback(
    (score: number) => {
      if (score <= 0) {
        return t("your-answer-was-not-correct")
      } else if (score < 1) {
        return t("your-answer-was-partially-correct")
      } else {
        return t("your-answer-was-correct")
      }
    },
    [t],
  )

  const customItemFeedback = useMemo(() => {
    if (!showScore || !itemFeedback) {
      return null
    }
    const customItemFeedback = itemFeedback.quiz_item_feedback?.trim()
    // If feedback on model solution is defined, this feedback takes precedence as the user is allowed to see the model solution and the teacher wants to show a custom message on the model solution
    const messageOnModelSolution = itemModelSolution?.messageOnModelSolution ?? null
    if (messageOnModelSolution !== null && messageOnModelSolution.trim() !== "") {
      return messageOnModelSolution.trim()
    }
    if (
      customItemFeedback === "" ||
      customItemFeedback === null ||
      customItemFeedback === undefined
    ) {
      return null
    }
    return customItemFeedback
  }, [itemFeedback, itemModelSolution?.messageOnModelSolution, showScore])

  const combinedFeedback = useMemo(() => {
    const trimmedSubmitMessage = submitMessage?.trim()
    if (!showScore) {
      return trimmedSubmitMessage && trimmedSubmitMessage !== "" ? trimmedSubmitMessage : null
    }
    const parts = [customItemFeedback, trimmedSubmitMessage].filter((part): part is string =>
      Boolean(part),
    )
    return parts.length > 0 ? parts.join(" ") : null
  }, [customItemFeedback, showScore, submitMessage])

  if (!showScore && !combinedFeedback) {
    return null
  }

  return (
    <div
      className={css`
        background: ${backgroundColor};
        box-sizing: border-box;
        border-radius: ${questionType === "closed-ended-question" ? "0.5rem" : "0.25rem"};
        color: ${textColor};
        margin: 1.5rem 0rem 1.5rem 0rem;
        margin-bottom: 0;
        padding: 0.875rem;
        max-width: 100%;
        display: flex;
        font-size: 1.125rem;
        line-height: 1.5rem;
        column-gap: 1rem;
      `}
    >
      <span
        className={css`
          position: relative;
          top: 2px;
          min-width: 1rem;
        `}
      >
        {questionType === "closed-ended-question" ? (
          <InfoCircle size={20} weight="bold" color="7A3F75" />
        ) : (
          <BullhornMegaphone size={20} weight="bold" color="7A3F75" />
        )}
      </span>

      <span>
        {showScore ? (
          <>
            {mapScoreToFeedback(userScore as number)}{" "}
            <ParsedText inline parseLatex parseMarkdown addDotToEnd text={combinedFeedback} />
          </>
        ) : (
          <ParsedText inline parseLatex parseMarkdown text={combinedFeedback} />
        )}
      </span>
    </div>
  )
}

const Submission: React.FC<React.PropsWithChildren<SubmissionProps>> = ({
  publicAlternatives,
  modelSolutions,
  gradingFeedbackJson: feedback_json,
  user_answer,
  user_information,
}) => {
  const { t } = useTranslation()
  const submitMessage = useMemo(() => {
    if (!feedback_json) {
      return null
    }
    const entry = feedback_json.find(
      (item) => item.quiz_item_id === null && item.quiz_item_feedback?.trim(),
    )
    return entry?.quiz_item_feedback?.trim() ?? null
  }, [feedback_json])

  // set wide screen direction to row if there is multiple-choice item
  // in quiz items
  let direction: FlexDirection = COLUMN
  publicAlternatives.items.every((item) => {
    if (item.type == "multiple-choice") {
      direction = sanitizeFlexDirection(item.optionDisplayDirection, COLUMN)
      return
    }
  })

  const hasTypeChanged = React.useMemo(() => {
    return user_answer.itemAnswers.some((userItem) => {
      const matchingPublicItem = publicAlternatives.items.find(
        (publicItem) => publicItem.id === userItem.quizItemId,
      )

      return !matchingPublicItem || userItem.type !== matchingPublicItem.type
    })
  }, [user_answer?.itemAnswers, publicAlternatives?.items])

  const orderedItems = useMemo(() => {
    return [...publicAlternatives.items].sort((i1, i2) => i1.order - i2.order)
  }, [publicAlternatives.items])

  const lastFeedbackItemId = useMemo(() => {
    if (!feedback_json) {
      return null
    }
    let lastId: string | null = null
    orderedItems.forEach((item) => {
      const descriptor = componentDescriptorByTypeName(item.type as QuizItemType)
      if (!descriptor?.shouldDisplayCorrectnessMessageAfterAnswer) {
        return
      }
      const hasFeedback = feedback_json.some(
        (itemFeedback) => itemFeedback.quiz_item_id === item.id,
      )
      if (hasFeedback) {
        lastId = item.id
      }
    })
    return lastId
  }, [feedback_json, orderedItems])

  const lastSubmitMessageItemId = useMemo(() => {
    if (!submitMessage) {
      return null
    }
    let lastId: string | null = null
    orderedItems.forEach((item) => {
      const hasAnswer = user_answer.itemAnswers.some((ia) => ia.quizItemId === item.id)
      if (hasAnswer) {
        lastId = item.id
      }
    })
    return lastId
  }, [orderedItems, submitMessage, user_answer.itemAnswers])

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {hasTypeChanged && (
        <GenericInfobox>{t("message-the-exercise-type-has-changed")}</GenericInfobox>
      )}
      {orderedItems.map((item) => {
        const componentDescriptor = componentDescriptorByTypeName(item.type as QuizItemType)
        if (!componentDescriptor) {
          return <div key={item.id}>{t("quiz-type-not-supported")}</div>
        }
        const itemAnswerFeedback = feedback_json
          ? feedback_json.filter((itemFeedback) => itemFeedback.quiz_item_id === item.id)[0]
          : null
        const itemModelSolution = modelSolutions
          ? modelSolutions.items.filter((itemModelSolution) => itemModelSolution.id === item.id)[0]
          : null
        const quizItemAnswer = user_answer.itemAnswers.filter((ia) => ia.quizItemId === item.id)[0]
        const feedback = itemAnswerFeedback &&
          componentDescriptor.shouldDisplayCorrectnessMessageAfterAnswer && (
            <SubmissionFeedback
              itemFeedback={itemAnswerFeedback}
              itemModelSolution={itemModelSolution}
              questionType={item.type as QuizItemType}
              submitMessage={item.id === lastFeedbackItemId ? submitMessage : null}
            />
          )
        const submitMessageOnly =
          !lastFeedbackItemId &&
          !componentDescriptor.shouldDisplayCorrectnessMessageAfterAnswer &&
          item.id === lastSubmitMessageItemId &&
          submitMessage ? (
            <SubmissionFeedback
              itemFeedback={itemAnswerFeedback}
              itemModelSolution={itemModelSolution}
              questionType={item.type as QuizItemType}
              submitMessage={submitMessage}
              showScore={false}
            />
          ) : null
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerCheckbox}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
                  {missingQuizItemAnswer}
                </FlexItem>
              )
            )
          case "choose-n":
            return (
              quizItemAnswer && (
                <FlexItem key={item.id}>
                  <ChooseN
                    key={item.id}
                    public_quiz_item={item as PublicSpecQuizItemChooseN}
                    quiz_direction={direction}
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerChooseN}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
                  {missingQuizItemAnswer}
                </FlexItem>
              )
            )
          case "closed-ended-question":
            return (
              quizItemAnswer && (
                <FlexItem key={item.id}>
                  <ClosedEndedQuestionFeedback
                    key={item.id}
                    public_quiz_item={item as PublicSpecQuizItemClosedEndedQuestion}
                    quiz_direction={direction}
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerClosedEndedQuestion}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerEssay}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerMatrix}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerMultiplechoice}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerMultiplechoiceDropdown}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerScale}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
                    quiz_item_answer_feedback={itemAnswerFeedback}
                    quiz_item_model_solution={itemModelSolution}
                    user_quiz_item_answer={quizItemAnswer as UserItemAnswerTimeline}
                    user_information={user_information}
                  />
                  {feedback}
                  {submitMessageOnly}
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
