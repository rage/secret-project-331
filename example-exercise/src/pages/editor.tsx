import { useEffect, useRef, useState } from "react"
import Editor from "../components/Editor"

export interface Alternative {
  id: string
  name: string
  correct: boolean
}

const EditorPage = () => {
  const [state, _setState] = useState<Alternative[] | null>(null)

  const stateRef = useRef(state)
  const setState = (data:Alternative[] | null) => {
    stateRef.current = data
    _setState(data)
  }

  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    const handleMessage = handleMessageCreator(setState, stateRef)
    console.log("Adding event listener...")
    window.addEventListener("message", handleMessage)
    if (window.parent === window) {
      console.warn(
        "Cannot inform the parent we're ready since there is no parent. Please make sure you're using this from an iframe."
      )
    } else {
      console.log("Telling the parent we're ready")
      window.parent.postMessage(
        { message: "ready", message_type: "moocfi/editor-message" },
        "*"
      )
    }
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])
  if (!state) {
    return <>Waiting for content...</>
  }
  return (
    <Editor onHeightChange={onHeightChange} state={state} setState={setState} />
  )
}

const handleMessageCreator = (setState: any, state: any) => {
  return function handleMessage(event: WindowEventMap["message"]) {
    // TODO verify event's origin since other sites or tabs can post events
    // as well
    if (event.data.message_type !== "moocfi/editor-message") {
      return
    }
    console.log("Frame received an event: ", JSON.stringify(event.data))
    if (event.data.message === "content") {
      setState(event.data.data || [])
    }
    if (event.data.message === "give-state") {
      window.parent.postMessage(
        {
          message: "current-state",
          message_type: "moocfi/editor-message",
          data: state.current,
        },
        "*"
      )
    }
  }
}

function onHeightChange(newHeight: number) {
  window.parent.postMessage(
    {
      message: "height-changed",
      data: newHeight,
      message_type: "moocfi/editor-message",
    },
    "*"
  )
}
export default EditorPage
