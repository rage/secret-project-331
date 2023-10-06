import { useCallback } from "react"

import {
  UserAnswer,
  UserItemAnswer,
  UserItemAnswerCheckbox,
  UserItemAnswerChooseN,
  UserItemAnswerClosedEndedQuestion,
  UserItemAnswerEssay,
  UserItemAnswerMatrix,
  UserItemAnswerMultiplechoice,
  UserItemAnswerMultiplechoiceDropdown,
  UserItemAnswerScale,
  UserItemAnswerTimeline,
} from "../../../../../types/quizTypes/answer"
import {
  PublicSpecQuiz,
  PublicSpecQuizItem,
  PublicSpecQuizItemCheckbox,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemEssay,
  PublicSpecQuizItemMatrix,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemScale,
  PublicSpecQuizItemTimeline,
} from "../../../../../types/quizTypes/publicSpec"
import useQuizzesUserAnswerOutputState from "../../../../hooks/useQuizzesUserAnswerServiceOutputState"
import { UserInformation } from "../../../../shared-module/exercise-service-protocol-types"
import { UpdateFunction } from "../../../../shared-module/hooks/exerciseServiceHooks/useExerciseServiceOutputState"
import { COLUMN, QUIZ_ITEM_CLASS } from "../../../../util/constants"
import { FlexDirection, sanitizeFlexDirection } from "../../../../util/css-sanitization"
import FlexWrapper from "../../../FlexWrapper"

import Checkbox from "./Checkbox"
import ChooseN from "./ChooseN"
import ClosedEndedQuestion from "./ClosedEndedQuestion"
import Essay from "./Essay"
import Matrix from "./Matrix/Matrix"
import MultipleChoice from "./MultipleChoice"
import MultipleChoiceDropdown from "./MultipleChoiceDropdown"
import Scale from "./Scale"
import Timeline from "./Timeline"
import Unsupported from "./Unsupported"

interface WidgetProps {
  publicSpec: PublicSpecQuiz
  user_information: UserInformation
  previousSubmission: UserAnswer | null
}

export interface WidgetReducerState {
  quiz: PublicSpecQuiz
  quiz_answer: UserAnswer
  quiz_answer_is_valid: boolean
}

type QuizItemAnswerWithoutId<T extends UserItemAnswer> = Omit<T, "quiz_item_id">

export interface QuizItemComponentProps<T extends PublicSpecQuizItem, K extends UserItemAnswer> {
  quizDirection: FlexDirection
  quizItem: T
  quizItemAnswerState: K | null
  user_information: UserInformation
  setQuizItemAnswerState: (newQuizItemAnswer: K) => void
}

const GetComponent: React.FC<{
  quizItem: PublicSpecQuizItem
  quizItemAnswerState: UserItemAnswer | null
  idx: number
  updateState: (func: UpdateFunction<UserAnswer>) => void
  user_information: UserInformation
  publicSpec: PublicSpecQuiz
}> = ({ quizItem, quizItemAnswerState, idx, updateState, user_information, publicSpec }) => {
  const updateUserItemAnswer = useCallback(
    (newQuizItemAnswer: UserItemAnswer): void => {
      updateState((userAnswer) => {
        if (!userAnswer) {
          console.error("User answer is null, cannot update it")
          return
        }
        // Update existing answer
        const item = userAnswer.itemAnswers.filter(
          (item) => item.quizItemId == newQuizItemAnswer.quizItemId,
        )
        if (!item) {
          userAnswer.itemAnswers = [...userAnswer.itemAnswers, newQuizItemAnswer]
        } else {
          userAnswer.itemAnswers = [
            ...userAnswer.itemAnswers.filter(
              (item) => item.quizItemId != newQuizItemAnswer.quizItemId,
            ),
            newQuizItemAnswer,
          ]
        }
      })
    },
    [updateState],
  )
  switch (quizItem.type) {
    case "checkbox":
      quizItem = quizItem as PublicSpecQuizItemCheckbox
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerCheckbox

      return (
        <Checkbox
          key={"checkbox-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerCheckbox>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "choose-n":
      quizItem = quizItem as PublicSpecQuizItemChooseN
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerChooseN
      return (
        <ChooseN
          key={"choose-n-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerChooseN>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "closed-ended-question":
      quizItem = quizItem as PublicSpecQuizItemClosedEndedQuestion
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerClosedEndedQuestion
      return (
        <ClosedEndedQuestion
          key={"closed-ended-question-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerClosedEndedQuestion>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "essay":
      quizItem = quizItem as PublicSpecQuizItemEssay
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerEssay
      return (
        <Essay
          key={"essay-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerEssay>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "matrix":
      quizItem = quizItem as PublicSpecQuizItemMatrix
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerMatrix
      return (
        <Matrix
          key={"matrix-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerMatrix>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "multiple-choice":
      quizItem = quizItem as PublicSpecQuizItemMultiplechoice
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerMultiplechoice
      return (
        <MultipleChoice
          key={"multiple-choice-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(quizItem.optionDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerMultiplechoice>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "multiple-choice-dropdown":
      quizItem = quizItem as PublicSpecQuizItemMultiplechoiceDropdown
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerMultiplechoiceDropdown
      return (
        <MultipleChoiceDropdown
          key={"multiple-choice-dropdown-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerMultiplechoiceDropdown>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "scale":
      quizItem = quizItem as PublicSpecQuizItemScale
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerScale
      return (
        <Scale
          key={"scale-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerScale>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    case "timeline":
      quizItem = quizItem as PublicSpecQuizItemTimeline
      quizItemAnswerState = quizItemAnswerState as UserItemAnswerTimeline
      return (
        <Timeline
          key={"timeline-" + quizItem.id}
          quizDirection={sanitizeFlexDirection(publicSpec.quizItemDisplayDirection, COLUMN)}
          quizItem={quizItem}
          quizItemAnswerState={quizItemAnswerState}
          user_information={user_information}
          setQuizItemAnswerState={(
            newQuizItemAnswer: QuizItemAnswerWithoutId<UserItemAnswerTimeline>,
          ) => {
            updateUserItemAnswer(newQuizItemAnswer)
          }}
        />
      )
    default:
      return <Unsupported key={idx} />
  }
}

const Widget: React.FC<React.PropsWithChildren<WidgetProps>> = ({
  publicSpec,
  user_information,
}) => {
  const direction: FlexDirection = sanitizeFlexDirection(
    publicSpec.quizItemDisplayDirection,
    COLUMN,
  )

  const { selected, updateState } = useQuizzesUserAnswerOutputState<UserAnswer>((uAnswer) => {
    return uAnswer
  })
  console.log("Widget")

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {publicSpec.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((quizItem, idx) => {
          // Quiz item answer state'
          let quizItemAnswerState: UserItemAnswer | null = null

          if (selected) {
            const found = selected.itemAnswers.find((qia) => qia.quizItemId === quizItem.id)
            if (found) {
              quizItemAnswerState = found
            }
          }
          return (
            <div className={QUIZ_ITEM_CLASS} key={quizItem.id}>
              <GetComponent
                idx={idx}
                key={"get-component-" + quizItem.id}
                quizItem={quizItem}
                quizItemAnswerState={quizItemAnswerState}
                updateState={updateState}
                user_information={user_information}
                publicSpec={publicSpec}
              />
            </div>
          )
        })}
    </FlexWrapper>
  )
}

export default Widget
