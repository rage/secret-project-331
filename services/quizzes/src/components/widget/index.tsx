import { useReducer } from "react"
import { v4 } from "uuid"

import { PublicQuiz, PublicQuizItem, QuizAnswer, QuizItemAnswer } from "../../../types/types"
import { useSendQuizAnswerOnChange } from "../../hooks/useSendQuizAnswerOnChange"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"

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
  quiz: PublicQuiz
  user_information: UserInformation
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
  quiz: PublicQuiz
  quiz_answer: QuizAnswer
  quiz_answer_is_valid: boolean
}

type QuizItemAnswerWithoutId = Omit<QuizItemAnswer, "quiz_item_id">

type Action = {
  quiz_item_answer: QuizItemAnswer
  type: "set-answer-state"
}

export interface QuizItemComponentProps {
  quizItem: PublicQuizItem
  quizItemAnswerState: QuizItemAnswer | null
  user_information: UserInformation
  setQuizItemAnswerState: (newQuizItemAnswer: QuizItemAnswerWithoutId) => void
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
  quiz,
  user_information,
}) => {
  const quiz_answer_id = v4()
  const widget_state: WidgetReducerState = {
    quiz: quiz,
    quiz_answer: {
      id: quiz_answer_id,
      quizId: quiz.id,
      createdAt: Date.now().toString(),
      updatedAt: Date.now().toString(),
      // eslint-disable-next-line i18next/no-literal-string
      status: "open",
      itemAnswers: quiz.items.map((qi) => {
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

  return (
    <>
      {state.quiz.items
        .sort((i1, i2) => i1.order - i2.order)
        .map((quizItem) => {
          const Component = componentsByTypeNames(quizItem.type as QuizItemType)
          const quizItemAnswerState =
            state.quiz_answer.itemAnswers.find((qia) => qia.quizItemId === quizItem.id) ?? null
          return (
            <Component
              key={quizItem.id}
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
    </>
  )
}

export default Widget
