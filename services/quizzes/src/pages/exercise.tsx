import { useRouter } from "next/dist/client/router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import Widget, { State } from "../components/widget"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { PublicQuiz } from "../types/types"

const ExercisePage: React.FC = () => {
  const { t } = useTranslation()
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
        // eslint-disable-next-line i18next/no-literal-string
        console.info("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          // eslint-disable-next-line i18next/no-literal-string
          console.info("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (isSetStateMessage(data)) {
            // eslint-disable-next-line i18next/no-literal-string
            console.info("Frame: setting state from message")
            // Quiz should be sent to the widget as a quiz object, not as a list containing the quiz object
            setQuiz(data.data as PublicQuiz)
          } else {
            // eslint-disable-next-line i18next/no-literal-string
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
    return <>{t("waiting-for-port")}</>
  }

  if (!quiz) {
    return <>{t("waiting-for-content")}</>
  }

  const quiz_answer_id = v4()
  const state: State = {
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
        }
      }),
    },
    quiz_answer_is_valid: false,
  }

  return <Widget port={port} maxWidth={maxWidth} initialState={state} />
}

export default ExercisePage
