import { css } from "@emotion/css"
import { useRouter } from "next/dist/client/router"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { PublicAlternative } from "../util/stateInterfaces"

const Editor: React.FC = () => {
  const [state, setState] = useState<PublicAlternative[] | null>(null)
  const [port, setPort] = useState<MessagePort | null>(null)
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = null
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  useEffect(() => {
    const handler = (message: WindowEventMap["message"]) => {
      if (message.origin !== parent.origin) {
        return
      }
      const port = message.ports[0]
      if (port) {
        console.log("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (data.message === "content") {
            console.log("Frame: setting state from message")
            setState(data.data)
          } else {
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    window.addEventListener("message", handler)

    // cleanup function
    return () => {
      window.removeEventListener("message", handler)
    }
  }, [])

  const contentRef = useRef<HTMLDivElement>(null)
  // Automatic height resizing events
  const [selectedId, _setSelectedId] = useState<string | null>(null)

  const setSelectedId: typeof _setSelectedId = (value) => {
    const res = _setSelectedId(value)
    if (!port) {
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }
    console.log("Posting current state to parent")
    port.postMessage({ message: "current-state-2", data: { selectedValue: value } })
    return res
  }

  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref || !port) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })

  if (!maxWidth) {
    return null
  }
  if (!state) {
    return <>Waiting for content...</>
  }

  if (!port) {
    return <>Waiting for port...</>
  }
  return (
    <div
      ref={contentRef}
      className={css`
        width: 100%;
        ${maxWidth && `max-width: ${maxWidth}px;`}
        margin: 0 auto;
        display: flex;
        flex-direction: column;
      `}
    >
      {state.map((option) => {
        const selected = selectedId === option.id
        return (
          <button
            className={css`
              padding: 1rem 2rem;
              background-color: ${selected ? "#4210f5" : "#6188ff"};
              border-radius: 1rem;
              border: 0;
              color: white;
              transition: all 0.3s;
              cursor: pointer;
              margin-top: 0.5rem;
              margin-bottom: 0.5rem;

              &:hover {
                background-color: ${selected ? "#330eb8" : "#507afb"};
              }
            `}
            aria-selected={selected}
            onClick={() => setSelectedId(option.id)}
            key={option.id}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

function onHeightChange(newHeight: number, port: MessagePort) {
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default Editor
