import { useReducer } from "react"
import { v4 } from "uuid"

import { UserAnswer, UserItemAnswer } from "../../../types/quizTypes/answer"
import { QuizItemType } from "../../../types/quizTypes/privateSpec"
import { PublicSpecQuiz, PublicSpecQuizItem } from "../../../types/quizTypes/publicSpec"
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

const componentsByTypeNames = (typeName: QuizItemType) => {
  const mapTypeToComponent: {
    [key: string]: React.ComponentClass<QuizItemComponentProps>
  } = {
    essay: Essay,
    "multiple-choice": MultipleChoice,
    checkbox: Checkbox,
    scale: Scale,
    open: Open,
    "custom-frontend-accept-data": Unsupported,
    "multiple-choice-dropdown": MultipleChoiceDropdown,
    "clickable-multiple-choice": MultipleChoiceClickable,
    matrix: Matrix,
    timeline: Timeline,
  }

  return mapTypeToComponent[typeName]
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
      quizId: publicSpec.id,
      createdAt: Date.now().toString(),
      updatedAt: Date.now().toString(),
      // eslint-disable-next-line i18next/no-literal-string
      status: "open",
      itemAnswers: publicSpec.items.map((qi) => {
        return {
          id: v4(),
          createdAt: Date.now().toString(),
          updatedAt: Date.now().toString(),
          quizItemId: qi.id,
          quizAnswerId: quiz_answer_id,
          correct: false,
          valid: false,
          intData: null,
          textData: null,
          optionAnswers: null,
          optionCells: null,
          timelineChoices: null,
        }
      }),
    },
    quiz_answer_is_valid: false,
  }
  const [state, dispatch] = useReducer(reducer, widget_state)

  useSendQuizAnswerOnChange(port, state)

  const direction = sanitizeFlexDirection(state.quiz.direction, COLUMN)

  return (
    <FlexWrapper wideScreenDirection={direction}>
      {state.quiz.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((quizItem) => {
          const Component = componentsByTypeNames(quizItem.type as QuizItemType)
          const quizItemAnswerState =
            state.quiz_answer.itemAnswers.find((qia) => qia.quizItemId === quizItem.id) ?? null
          return (
            <Component
              key={quizItem.id}
              quizDirection={direction}
              quizItem={quizItem}
              quizItemAnswerState={quizItemAnswerState}
              user_information={user_information}
              setQuizItemAnswerState={(newQuizItemAnswer: QuizItemAnswerWithoutId) => {
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
        })}
    </FlexWrapper>
  )
}

export default Widget
