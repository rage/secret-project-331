import { denormalize, normalize } from "normalizr"
import React, { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import { v4 } from "uuid"

import StatelessEditor from "../components/StatelessEditor"
import { normalizedQuiz } from "../schemas"
import { CurrentStateMessage, HeightChangedMessage } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { initializedEditor } from "../store/editor/editorActions"
import { StoreState, useTypedSelector } from "../store/store"
import { Entities, Quiz } from "../types/types"

const Editor: React.FC = () => {
  const [port, setPort] = useState<MessagePort | null>(null)
  const dispatch = useDispatch()

  const state = useTypedSelector((state) => state)

  useEffect(() => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      message: "current-state",
      data: { private_spec: denormalizeData(state) },
      valid: true,
    }
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
        console.log("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (isSetStateMessage(data)) {
            console.log("Frame: setting state from message")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dispatch(initializedEditor(normalizeData(data.data as any), data as any))
          } else {
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    console.log("frame adding event listener")
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      console.log("removing event listener")
      removeEventListener("message", handler)
    }
  })

  if (!state.editor.quizId) {
    return <>Waiting for content...</>
  }

  if (!port) {
    return <>Waiting for port...</>
  }

  return <StatelessEditor onHeightChange={onHeightChange} port={port} />
}

function onHeightChange(newHeight: number, port: MessagePort) {
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
  awardPointsEvenIfWrong: true,
  body: "",
  courseId: v4(),
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: true,
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
