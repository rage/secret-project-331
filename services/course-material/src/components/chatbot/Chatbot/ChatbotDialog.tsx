import { css, keyframes } from "@emotion/css"
import React, { useContext, useEffect, useId, useState } from "react"
import { Dialog, Modal, OverlayTriggerStateContext } from "react-aria-components"

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
    let searchDialog: Element | null = document.body.querySelector(
      `div[aria-label="Search dialog"]`,
    )
    console.log(searchDialog)

    if (searchDialog === null && shouldRender) {
      // !! this breaks the search dialog if the chatbot dialog is open
      // remove the scroll prevention set by react-aria Modal
      // eslint-disable-next-line i18next/no-literal-string
      document.documentElement.style.overflow = "scroll"
      // remove the interaction prevention set by react-aria Modal
      // eslint-disable-next-line i18next/no-literal-string
      document.body.querySelector("div")?.removeAttribute("inert")
    }
  })

  return (
    <>
      <OpenChatbotButton hide={shouldRender} />
      <Modal isOpen={shouldRender} onOpenChange={state?.toggle}>
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
          <ChatbotChat
            chatbotConfigurationId={chatbotConfigurationId}
            isCourseMaterialBlock={false}
            chatbotTitleId={chatbotTitleId}
          />
        </Dialog>
      </Modal>
    </>
  )
}

export default React.memo(ChatbotDialog)
