import { css, keyframes } from "@emotion/css"
import React, { useContext, useEffect, useId, useState } from "react"
import { OverlayTriggerStateContext, Popover } from "react-aria-components"

import ChatbotChat from "./ChatbotChat"
import OpenChatbotButton from "./OpenChatbotButton"

import { ChatbotProps } from "."

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

const ChatbotDialog: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const chatbotTitleId = useId()
  let state = { ...useContext(OverlayTriggerStateContext), close: () => {} }
  const [shouldRender, setShouldRender] = useState(false)
  console.log(state)

  useEffect(() => {
    if (state?.isOpen) {
      setShouldRender(true)
    }
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  }, [state?.isOpen])

  /*   const handleAnimationEnd = () => {
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  } */

  return (
    <>
      <OpenChatbotButton hide={shouldRender} />
      <Popover
        aria-labelledby={chatbotTitleId}
        className={css`
          animation: ${state?.isOpen ? openAnimation : closeAnimation} 0.3s forwards;
          right: 1rem;
          width: ${CHATBOX_WIDTH_PX}px;
          max-width: 90vw;
          height: ${CHATBOX_HEIGHT_PX}px;
          max-height: 90vh;
        `}
        //onAnimationEnd={handleAnimationEnd}
        isNonModal={true}
        placement="top"
        shouldCloseOnInteractOutside={() => false}
        offset={-60}
      >
        <ChatbotChat
          chatbotConfigurationId={chatbotConfigurationId}
          isCourseMaterialBlock={false}
          chatbotTitleId={chatbotTitleId}
        />
      </Popover>
    </>
  )
}

export default React.memo(ChatbotDialog)
