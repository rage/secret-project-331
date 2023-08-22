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
} from "../../../types/quizTypes/answer"
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
} from "../../../types/quizTypes/publicSpec"
import useQuizzesUserAnswerOutputState from "../../hooks/useQuizzesUserAnswerServiceOutputState"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"
import { COLUMN, QUIZ_ITEM_CLASS } from "../../util/constants"
import { FlexDirection, sanitizeFlexDirection } from "../../util/css-sanitization"
import FlexWrapper from "../FlexWrapper"

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

  const updateUserItemAnswer = (newQuizItemAnswer: UserItemAnswer): void => {
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
  }

  const GetComponent: React.FC<{
    quizItem: PublicSpecQuizItem
    quizItemAnswerState: UserItemAnswer | null
    idx: number
  }> = ({ quizItem, quizItemAnswerState, idx }) => {
    switch (quizItem.type) {
      case "checkbox":
        quizItem = quizItem as PublicSpecQuizItemCheckbox
        quizItemAnswerState = quizItemAnswerState as UserItemAnswerCheckbox

        return (
          <Checkbox
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
            key={quizItem.id}
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
                quizItem={quizItem}
                quizItemAnswerState={quizItemAnswerState}
              />
            </div>
          )
        })}
    </FlexWrapper>
  )
}

export default Widget
