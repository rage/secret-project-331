import { useReducer } from "react"

import { useSendQuizAnswerOnChange } from "../../hooks/useSendQuizAnswerOnChange"
import { PublicQuiz, PublicQuizItem, QuizAnswer, QuizItemAnswer } from "../../types/types"
import HeightTrackingContainer from "../HeightTrackingComponent"

import MultipleChoice from "./MultipleChoice"
import Unsupported from "./Unsupported"

interface WidgetProps {
  port: MessagePort
  maxWidth: number | null
  initialState: State
}

type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "custom-frontend-accept-data"

const componentsByTypeNames = (typeName: QuizItemType) => {
  const mapTypeToComponent: { [key: string]: React.FC<QuizItemComponentProps> } = {
    essay: Unsupported,
    "multiple-choice": MultipleChoice,
    scale: Unsupported,
    checkbox: Unsupported,
    open: Unsupported,
    "custom-frontend-accept-data": Unsupported,
    "multiple-choice-dropdown": Unsupported,
    "clickable-multiple-choice": Unsupported,
  }

  return mapTypeToComponent[typeName]
}

export interface State {
  quiz: PublicQuiz
  quiz_answer: QuizAnswer
}

type QuizItemAnswerWithoutId = Omit<QuizItemAnswer, "quiz_item_id">

type Action = {
  quiz_item_answer: QuizItemAnswer
  type: "set-answer-state"
}

export interface QuizItemComponentProps {
  quizItem: PublicQuizItem
  quizItemAnswerState: QuizItemAnswer | null
  setQuizItemAnswerState: (newQuizItemAnswer: QuizItemAnswerWithoutId) => void
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set-answer-state":
      return {
        ...state,
        quiz_answer: {
          ...state.quiz_answer,
          itemAnswers: state.quiz_answer.itemAnswers.map((qia) => {
            if (qia.quizItemId !== action.quiz_item_answer.quizItemId) {
              return qia
            }
            return action.quiz_item_answer
          }),
        },
      }
    default:
      return state
  }
}

const Widget: React.FC<WidgetProps> = ({ port, initialState }) => {
  const [state, dispatch] = useReducer(reducer, initialState)

  useSendQuizAnswerOnChange(port, state)

  return (
    <HeightTrackingContainer port={port}>
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
    </HeightTrackingContainer>
  )
}

export default Widget
