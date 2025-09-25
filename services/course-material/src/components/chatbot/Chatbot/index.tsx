import { css, keyframes } from "@emotion/css"
import React, { useContext, useEffect, useId, useState } from "react"
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
  let state = useContext(OverlayTriggerStateContext)
  const [shouldRender, setShouldRender] = useState(state?.isOpen)

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

  if (!shouldRender) {
    return <OpenChatbotButton />
  }

  return (
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
