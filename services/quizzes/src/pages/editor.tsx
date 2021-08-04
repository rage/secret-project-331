import { denormalize, normalize } from "normalizr"
import React, { useEffect } from "react"
import { useDispatch } from "react-redux"
import { v4 } from "uuid"

import StatelessEditor from "../components/StatelessEditor"
import { normalizedQuiz } from "../schemas"
import { initializedEditor } from "../store/editor/editorActions"
import { storeState, useTypedSelector } from "../store/store"
import { Quiz } from "../types/types"

const Editor: React.FC = () => {
  const dispatch = useDispatch()
  const store = useTypedSelector((state) => state)

  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    const handleMessage = handleMessageCreator()
    console.log("Adding event listener...")
    window.addEventListener("message", handleMessage)
    if (window.parent === window) {
      console.warn(
        "Cannot inform the parent we're ready since there is no parent. Please make sure you're using this from an iframe.",
      )
    } else {
      console.log("Telling the parent we're ready")
      window.parent.postMessage({ message: "ready", message_type: "moocfi/editor-message" }, "*")
    }
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  })

  const handleMessageCreator = () => {
    return function handleMessage(event: WindowEventMap["message"]) {
      if (event.data.message_type !== "moocfi/editor-message") {
        return
      }
      console.log("Frame received an event: ", JSON.stringify(event.data))
      if (event.data.message === "content") {
        dispatch(initializedEditor(normalizeData(event.data.data), event.data.data))
      }
      if (event.data.message === "give-state") {
        const data = denormalizeData(store)
        window.parent.postMessage(
          {
            message: "current-state",
            message_type: "moocfi/editor-message",
            data: data,
          },
          "*",
        )
      }
    }
  }

  return <StatelessEditor onHeightChange={onHeightChange} />
}

const onHeightChange = (newHeight: number) => {
  window.parent.postMessage(
    {
      message: "height-changed",
      data: newHeight,
      message_type: "moocfi/editor-message",
    },
    "*",
  )
}

const normalizeData = (data: storeState) => {
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

const denormalizeData = (store: storeState) => {
  const quizData = {
    quizzes: store.editor.quizzes,
    items: store.editor.items,
    options: store.editor.options,
    quizId: store.editor.quizId,
  }
  return denormalize(quizData.quizId, normalizedQuiz, quizData)
}

//From parent?
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
  grantPointsPolicy: "",
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
