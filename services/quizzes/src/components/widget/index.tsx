import { useReducer } from "react"
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
import { useSendQuizAnswerOnChange } from "../../hooks/useSendQuizAnswerOnChange"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"
import { FlexDirection, sanitizeFlexDirection } from "../../shared-module/utils/css-sanitization"
import { COLUMN } from "../../util/constants"
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

type Action = {
  quiz_item_answer: UserItemAnswer
  type: "set-answer-state"
}

export interface QuizItemComponentProps<T extends PublicSpecQuizItem, K extends UserItemAnswer> {
  quizDirection: FlexDirection
  quizItem: T
  quizItemAnswerState: K | null
  user_information: UserInformation
  setQuizItemAnswerState: (newQuizItemAnswer: K) => void
}

function reducer(state: WidgetReducerState, action: Action): WidgetReducerState {
  switch (action.type) {
    case "set-answer-state": {
      const itemAnswers = state.quiz_answer.itemAnswers.map((qia) => {
        if (qia.quizItemId !== action.quiz_item_answer.quizItemId) {
          return qia
        }
        return action.quiz_item_answer
      })
      return {
        ...state,
        quiz_answer: {
          ...state.quiz_answer,
          itemAnswers,
        },
        quiz_answer_is_valid: itemAnswers.every((x) => x.valid),
      }
    }
    default:
      return state
  }
}

const Widget: React.FC<React.PropsWithChildren<WidgetProps>> = ({
  port,
  publicSpec,
  previousSubmission,
  user_information,
}) => {
  const quiz_answer_id = v4()
  const widget_state: WidgetReducerState = {
    quiz: publicSpec,
    quiz_answer: previousSubmission || {
      id: quiz_answer_id,
      itemAnswers: [],
    },
    // TODO: validate previous submission in the future
    quiz_answer_is_valid: !!previousSubmission,
  }
  const [state, dispatch] = useReducer(reducer, widget_state)

  useSendQuizAnswerOnChange(port, state)

  // set wide screen direction to row if there is multiple-choice item
  // in quiz items
  let direction: FlexDirection = COLUMN
  state.quiz.items.every((item) => {
    if (item.type == "multiple-choice") {
      direction = sanitizeFlexDirection(item.direction, COLUMN)
      return
    }
  })

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {state.quiz.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((quizItem, idx) => {
          let quizItemAnswerState =
            state.quiz_answer.itemAnswers.find((qia) => qia.quizItemId === quizItem.id) ?? null
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
                    dispatch({
                      type: "set-answer-state",
                      quiz_item_answer: {
                        ...newQuizItemAnswer,
                        quizItemId: quizItem.id,
                      },
                    })
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
