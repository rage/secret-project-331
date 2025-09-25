import { css, keyframes } from "@emotion/css"
import React, { useContext, useEffect, useId, useRef, useState } from "react"
import { FocusScope } from "react-aria"
import { Dialog, DialogTrigger, OverlayTriggerStateContext } from "react-aria-components"

import ChatbotDialog from "./ChatbotDialog"
import OpenChatbotButton from "./OpenChatbotButton"

export const CHATBOX_WIDTH_PX = 500
export const CHATBOX_HEIGHT_PX = 900

const openAnimation = keyframes`
  from {
    transform: translateY(150%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`

const closeAnimation = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(150%);
    opacity: 0;
  }
`

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const chatbotTitleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  let state = useContext(OverlayTriggerStateContext)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (state?.isOpen) {
      setShouldRender(true)
    }
  }, [state?.isOpen])

  const handleAnimationEnd = () => {
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  }

  useEffect(() => {
    const removeListenersAbortController = new AbortController()
    const currentRef = dialogRef.current
    currentRef?.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          state?.close()
        }
      },
      { signal: removeListenersAbortController.signal },
    )

    return () => {
      removeListenersAbortController.abort()
    }
  }, [state])

  return (
    <>
      <OpenChatbotButton hide={shouldRender} />
      <div ref={dialogRef}>
        {shouldRender && (
          // eslint-disable-next-line jsx-a11y/no-autofocus
          <FocusScope restoreFocus autoFocus>
            <Dialog
              aria-labelledby={chatbotTitleId}
              className={css`
                animation: ${state?.isOpen ? openAnimation : closeAnimation} 0.3s forwards;
                position: fixed;
                bottom: 70px;
                right: 1rem;
                z-index: 1000;
              `}
              onAnimationEnd={handleAnimationEnd}
            >
              <ChatbotDialog
                chatbotConfigurationId={chatbotConfigurationId}
                isCourseMaterialBlock={false}
                chatbotTitleId={chatbotTitleId}
              />
            </Dialog>
          </FocusScope>
        )}
      </div>
    </>
  )
}

interface ChatbotProps {
  chatbotConfigurationId: string
}

const ChatbotTrigger: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return (
    <DialogTrigger defaultOpen={false}>
      <Chatbot chatbotConfigurationId={chatbotConfigurationId} />
    </DialogTrigger>
  )
}

export default React.memo(ChatbotTrigger)
