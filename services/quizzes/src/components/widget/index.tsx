import { v4 } from "uuid"

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
import { useSendQuizAnswerOnChange } from "../../hooks/useSendQuizAnswerOnChange"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"
import { FlexDirection, sanitizeFlexDirection } from "../../shared-module/utils/css-sanitization"
import { COLUMN } from "../../util/constants"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import FlexWrapper from "../FlexWrapper"

import Checkbox from "./Checkbox"
import Essay from "./Essay"
import Matrix from "./Matrix/Matrix"
import MultipleChoice from "./MultipleChoice"
import MultipleChoiceClickable from "./MultipleChoiceClickable"
import MultipleChoiceDropdown from "./MultipleChoiceDropdown"
import Open from "./Open"
import Scale from "./Scale"
import Timeline from "./Timeline"
import Unsupported from "./Unsupported"

interface WidgetProps {
  port: MessagePort
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
  port,
  publicSpec,
  previousSubmission,
  user_information,
}) => {
  const widget_state: WidgetReducerState = {
    quiz: publicSpec,
    quiz_answer: previousSubmission || {
      itemAnswers: [],
    },
    // TODO: validate previous submission in the future
    quiz_answer_is_valid: !!previousSubmission,
  }

  useSendQuizAnswerOnChange(port, widget_state)

  // set wide screen direction to row if there is multiple-choice item
  // in quiz items
  let direction: FlexDirection = COLUMN
  if (publicSpec != null) {
    console.log(publicSpec)
    publicSpec.items.every((item) => {
      console.log("Item:", item)
      if (item.type == "multiple-choice") {
        direction = sanitizeFlexDirection(item.direction, COLUMN)
        return
      }
    })
  }

  const { selected, updateState } = useQuizzesUserAnswerOutputState<UserAnswer>((uAnswer) => {
    if (!uAnswer) {
      return null
    }
    return uAnswer
  })

  if (previousSubmission) {
    updateState((draft) => {
      if (!draft) {
        return
      }
      draft = previousSubmission
    })
  }

  const updateUserItemAnswer = (newQuizItemAnswer: UserItemAnswer): void => {
    updateState((userAnswer) => {
      if (!userAnswer) {
        return
      }
      const item = userAnswer.itemAnswers.filter((item) => item.id == newQuizItemAnswer.id)
      if (!item) {
        userAnswer.itemAnswers = [...userAnswer.itemAnswers, newQuizItemAnswer]
      } else {
        userAnswer.itemAnswers = [
          ...userAnswer.itemAnswers.filter((item) => item.id != newQuizItemAnswer.id),
          newQuizItemAnswer,
        ]
      }
    })
  }

  console.group("Widget.js")
  console.log("Old quiz:", isOldQuiz(publicSpec))
  console.log("public spec:", publicSpec)
  console.log("state: ", widget_state)
  console.log("previous submission:", previousSubmission)
  console.log("Selected:", selected)
  console.groupEnd()

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {publicSpec.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((quizItem, idx) => {
          // Quiz item answer state'
          let quizItemAnswerState: UserItemAnswer = {
            id: v4(),
            quizItemId: quizItem.id,
          } as UserItemAnswer
          if (selected) {
            const found = selected.itemAnswers.find((qia) => qia.quizItemId === quizItem.id)
            if (found) {
              quizItemAnswerState = found
            }
          }

          switch (quizItem.type) {
            case "checkbox":
              quizItem = quizItem as PublicSpecQuizItemCheckbox
              quizItemAnswerState = quizItemAnswerState as UserItemAnswerCheckbox
              return (
                <Checkbox
                  key={quizItem.id}
                  quizDirection={COLUMN}
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
                <MultipleChoiceClickable
                  key={quizItem.id}
                  quizDirection={COLUMN}
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
                <Open
                  key={quizItem.id}
                  quizDirection={COLUMN}
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
                  quizDirection={COLUMN}
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
                  quizDirection={COLUMN}
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
                  quizDirection={sanitizeFlexDirection(quizItem.direction, COLUMN)}
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
                  quizDirection={COLUMN}
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
                  quizDirection={COLUMN}
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
                  quizDirection={COLUMN}
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
              break
          }
          return <Unsupported key={idx} />
        })}
    </FlexWrapper>
  )
}

export default Widget
