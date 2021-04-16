import { PropsWithChildren, useEffect, useRef, useState } from "react"
import { Alert } from "@material-ui/lab"
import styled from "@emotion/styled"
import { ExerciseItem, PageUpdateExerciseItem } from "../../services/services.types"
import React from "react"
import { SetterOrUpdater, useRecoilState } from "recoil"
import { exerciseItemFamilySelector } from "../../state/exercises"
import { saveResolveMap } from "../../components/Editor"
import { ExerciseItemAttributes } from "."
import { BlockEditProps } from "@wordpress/blocks"

// React memo to prevent iFrame re-render, try with console log from example exercise?
const Iframe = React.memo(styled.iframe`
  width: 100%;

  /*
   To see the size of the frame in development
   Only top and bottom because frame is 100% of window width
   and extra border would create a scrollbar
  */
  border-top: 1px solid black;
  border-bottom: 1px solid black;
`)

interface IFrameEditorProps {
  props: PropsWithChildren<BlockEditProps<ExerciseItemAttributes>>
  url: string
  exerciseItemid: string
}

const IFrameEditor: React.FC<IFrameEditorProps> = ({ url, props, exerciseItemid }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  /* If we initially set the iFrame content from props.attributes (i.e. block attributes), 
  and we constantly update the state without re-rendering the iFrame we probably should
  use useRecoilSetState to avoid re-rendering.
  So the workflow when entering page edit mode:
    1. Get pages, receive all exercises/exercise_items
    2. Create Recoil state for each exercise and/or exercise_items (in Editor.tsx)
    3. Each exerciseItemId creates an useRecoilSetState (in this file)
    4. When iFrame posts (onChange) events, we update the recoilState
    5. When we save we save from the state with a useRecoilCallback so that we dont need to subscribe to the atom
  Alternative: Try React.memo for iFrame and use props.setAttributes()
  */
  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    const handleMessage = handleMessageCreator(
      iframeRef.current,
      props
    )
    window.addEventListener("message", handleMessage)
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])

  console.log("Rendering...")
  if (!url) {
    return <Alert severity="error">Cannot render exercise item editor, missing url.</Alert>
  }
  return (
    <Iframe
      ref={iframeRef}
      src={url}
      frameBorder="off"
    /> 
  )
}

const handleMessageCreator = (
  iframeRef: HTMLIFrameElement | null,
  props: PropsWithChildren<BlockEditProps<ExerciseItemAttributes>>
) => {
  return async function handleMessage(event: WindowEventMap["message"]) {
    if (
      event.data.message_type !== "moocfi/editor-message" ||
      iframeRef.contentWindow !== event.source
    ) {
      return
    }
    console.log("Parent received an event: ", JSON.stringify(event.data))

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
        // Set the initial state that is found in Gutenberg JSON?
        contentWindow.postMessage(
          {
            message: "content",
            message_type: "moocfi/editor-message",
            data: props.attributes.spec,
          },
          "*",
        )
        return
      }
      case "height-changed": {
        // Häkki solution to get rid of useState for iFrameHeight and well... scrollbar.
        iframeRef.height = (Number(event.data.data)+10).toString() + "px"
        return
      }
      case "current-state2": {
        // Currently this re-renders, we should useRecoilSetState here, right
        // trying now with React.memo?
        props.setAttributes({spec: event.data.data})
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
