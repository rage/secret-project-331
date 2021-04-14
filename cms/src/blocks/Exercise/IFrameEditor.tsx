import { useEffect, useRef, useState } from "react"
import { Alert } from "@material-ui/lab"
import styled from "styled-components"
import { ExerciseItem, PageUpdateExerciseItem } from "../../services/services.types"
import React from "react"
import { SetterOrUpdater, useRecoilState } from "recoil"
import { exerciseItemFamilySelector } from "../../state/exercises"
import { saveResolveMap } from "../../components/Editor"

const Iframe = styled.iframe`
  width: 100%;
  // To see the size of the frame in development
  // Only top and bottom because frame is 100% of window width
  // and extra border would create a scrollbar
  border-top: 1px solid black;
  border-bottom: 1px solid black;
`

interface IFrameEditorProps {
  url: string
  parentId: string
  exerciseItemid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, parentId, exerciseItemid }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameHeight, setFrameHeight] = useState(50)
  const [exerciseItem, setExerciseItem] = useRecoilState(
    exerciseItemFamilySelector([parentId, exerciseItemid]),
  )
  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    const handleMessage = handleMessageCreator(
      iframeRef.current,
      setFrameHeight,
      setExerciseItem,
      exerciseItem,
    )
    window.addEventListener("message", handleMessage)
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])

  if (!url) {
    return <Alert severity="error">Cannot render exercise item editor, missing url.</Alert>
  }
  return (
    <Iframe
      data-exercise-item-id={exerciseItem.id}
      height={frameHeight}
      ref={iframeRef}
      src={url}
      frameBorder="off"
    />
  )
}

const handleMessageCreator = (
  iframeRef: HTMLIFrameElement | null,
  onHeightChange: (newHeight: number) => void,
  setExerciseItem: SetterOrUpdater<ExerciseItem | PageUpdateExerciseItem>,
  exerciseItem: ExerciseItem | PageUpdateExerciseItem,
) => {
  return async function handleMessage(event: WindowEventMap["message"]) {
    if (
      event.data.message_type !== "moocfi/editor-message" ||
      iframeRef.contentWindow !== event.source
    ) {
      return
    }
    console.log("Parent received an event: ", JSON.stringify(event.data))

    // Handle message types.
    switch (event.data.message) {
      case "ready": {
        if (!iframeRef) {
          console.error("Cannot send data to iframe because reference does not exist.")
          return
        }
        const contentWindow = iframeRef.contentWindow
        if (!contentWindow) {
          console.error("No frame content window")
          return
        }
        contentWindow.postMessage(
          {
            message: "content",
            message_type: "moocfi/editor-message",
            data: exerciseItem.spec,
          },
          "*",
        )
        return
      }
      case "height-changed": {
        onHeightChange(event.data.data)
        return
      }
      case "current-state": {
        const resolve = saveResolveMap.get(exerciseItem.id)
        if (resolve) {
          resolve(event.data.data)
        }
        setExerciseItem((prev: ExerciseItem | PageUpdateExerciseItem) => {
          return {
            ...prev,
            spec: event.data.data,
          }
        })
        return
      }
      default: {
        console.warn("Unexpected message", JSON.stringify(event.data))
        return
      }
    }
  }
}

export default IFrameEditor
