import { denormalize, normalize } from "normalizr"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { v4 } from "uuid"

import { Entities, Quiz } from "../../types/types"
import StatelessEditor from "../components/StatelessEditor"
import { normalizedQuiz } from "../schemas"
import { CurrentStateMessage, HeightChangedMessage } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { initializedEditor } from "../store/editor/editorActions"
import { StoreState, useTypedSelector } from "../store/store"

const Editor: React.FC = () => {
  const { t } = useTranslation()
  const [port, setPort] = useState<MessagePort | null>(null)
  const dispatch = useDispatch()

  const state = useTypedSelector((state) => state)

  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data: { private_spec: denormalizeData(state) },
      valid: true,
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  }, [state, port])

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dispatch(initializedEditor(normalizeData(data.data as any), data as any))
          } else {
            // eslint-disable-next-line i18next/no-literal-string
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("frame adding event listener")
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      // eslint-disable-next-line i18next/no-literal-string
      console.info("removing event listener")
      removeEventListener("message", handler)
    }
  })

  if (!state.editor.quizId) {
    return <>{t("waiting-for-content")}</>
  }

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  return <StatelessEditor onHeightChange={onHeightChange} port={port} />
}

function onHeightChange(newHeight: number, port: MessagePort) {
  // eslint-disable-next-line i18next/no-literal-string
  const message: HeightChangedMessage = { message: "height-changed", data: newHeight }
  port.postMessage(message)
}

const normalizeData = (data: StoreState) => {
  const normalizedInputData = normalize(data === null ? emptyQuiz : data, normalizedQuiz)
  return {
    quizzes: normalizedInputData.entities.quizzes ?? {},
    items: normalizedInputData.entities.items ?? {},
    options: normalizedInputData.entities.options ?? {},
    result: normalizedInputData.result ?? "",
    peerReviewCollections: normalizedInputData.entities.peerReviewCollections ?? {},
    questions: normalizedInputData.entities.questions ?? {},
  }
}

const denormalizeData = (state: StoreState) => {
  const entities: Entities = {
    quizzes: state.editor.quizzes,
    items: state.editor.items,
    result: state.editor.quizId,
    options: state.editor.options,
  }
  const res = denormalize(state.editor.quizId, normalizedQuiz, entities)
  return res
}

const emptyQuiz: Quiz = {
  id: v4(),
  autoConfirm: true,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: v4(),
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: true,
  // eslint-disable-next-line i18next/no-literal-string
  grantPointsPolicy: "grant_whenever_possible",
  items: [],
  part: 0,
  points: 0,
  section: 0,
  submitMessage: "",
  title: "",
  tries: 1,
  triesLimited: true,
  updatedAt: new Date(),
  open: new Date(),
}

export default Editor
