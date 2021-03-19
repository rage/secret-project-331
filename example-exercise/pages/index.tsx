import { useEffect, useRef, useState } from "react"
import styled from "styled-components"

const Title = styled.h1`
  font-size: 24px;
`

const Iframe = styled.iframe`
  width: 100%;
  // To see the size of the frame in development
  // Only top and bottom because frame is 100% of window width
  // and extra border would create a scrollbar
  border-top: 1px solid black;
  border-bottom: 1px solid black;
`

const exampleExerciseSpec = [
  {
    name: "A",
    correct: false,
  },
  {
    name: "C",
    correct: false,
  },
  {
    name: "D",
    correct: true,
  },
]

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameHeight, setFrameHeight] = useState(50)
  useEffect(() => {
    if (typeof window === undefined) {
      console.log("Not adding a event listener because window is undefined.")
      return
    }
    console.log("Adding event listener...")
    const handleMessage = handleMessageCreator(
      iframeRef.current,
      setFrameHeight
    )
    window.addEventListener("message", handleMessage)
    const removeListener = () => {
      console.log("Removing event listener")
      window.removeEventListener("message", handleMessage)
    }
    return removeListener
  }, [])
  return (
    <>
      <Title>Iframe test page</Title>
      <Iframe
        height={frameHeight}
        ref={iframeRef}
        src="/editor"
        frameBorder="off"
      />
    </>
  )
}

const handleMessageCreator = (
  iframeRef: HTMLIFrameElement | null,
  onHeightChange: (newHeight: number) => void
) => {
  return function handlemessage(event: WindowEventMap["message"]) {
    // TODO verify event's origin since other sites or tabs can post events
    // as well
    if (event.data.message_type !== "moocfi/editor-message") {
      return
    }
    console.log("Parent received an event: ", JSON.stringify(event.data))
    if (event.data.message === "ready") {
      if (!iframeRef) {
        console.error(
          "Cannot send data to iframe because reference does not exist."
        )
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
          data: exampleExerciseSpec,
        },
        "*"
      )
    }
    if (event.data.message === "height-changed") {
      onHeightChange(event.data.data)
    }
  }
}
