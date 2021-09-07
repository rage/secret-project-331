import { useRouter } from "next/dist/client/router"
import { useEffect, useState } from "react"
import { v4 } from "uuid"

import Widget, { State } from "../components/widget"
import { PublicQuiz } from "../types/types"

const ExercisePage: React.FC = () => {
  const [port, setPort] = useState<MessagePort | null>(null)
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null)

  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = null
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  useEffect(() => {
    const handler = (message: WindowEventMap["message"]) => {
      if (message.source !== parent) {
        return
      }
      const port = message.ports[0]
      if (port) {
        console.log("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (data.message === "set-state") {
            console.log("Frame: setting state from message")
            setQuiz(data.data[0])
          } else {
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      removeEventListener("message", handler)
    }
  }, [])

  if (!maxWidth) {
    return null
  }

  if (!port) {
    return <>Waiting for port...</>
  }

  if (!quiz) {
    return <>Waiting for data...</>
  }

  const quiz_answer_id = v4()
  const state: State = {
    quiz: quiz,
    quiz_answer: {
      id: quiz_answer_id,
      quizId: quiz.id,
      createdAt: Date.now().toString(),
      updatedAt: Date.now().toString(),
      itemAnswers: quiz.items.map((qi) => {
        return {
          id: v4(),
          createdAt: Date.now().toString(),
          updatedAt: Date.now().toString(),
          quizItemId: qi.id,
          quizAnswerId: quiz_answer_id,
          correct: false,
          intData: null,
          textData: null,
          optionAnswers: [],
        }
      }),
    },
  }

  return <Widget port={port} maxWidth={maxWidth} initialState={state} />
}

export default ExercisePage
