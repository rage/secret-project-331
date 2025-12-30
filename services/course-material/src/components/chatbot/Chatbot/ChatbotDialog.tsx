import { css, keyframes } from "@emotion/css"
import React, { useContext, useEffect, useId, useRef, useState } from "react"
import {
  FocusScope,
  mergeProps,
  OverlayProvider,
  useModal,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
  usePopover,
} from "react-aria"
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
  const [shouldRender, setShouldRender] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  let buttonRef = useRef(null)
  let state = {
    isOpen,
    setOpen: (o: boolean) => {
      setIsOpen(o)
    },
    open: () => {
      setIsOpen(true)
    },
    close: () => {},
    toggle: () => {
      setIsOpen(!isOpen)
    },
  }
  let { triggerProps, overlayProps } = useOverlayTrigger({ type: "dialog" }, state, buttonRef)
  console.log(state)

  useEffect(() => {
    if (state?.isOpen) {
      setShouldRender(true)
    }
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  }, [state?.isOpen])

  const handleAnimationEnd = () => {
    console.log("on animation end")
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  }

  let popoverRef = useRef(null)
  let { popoverProps } = usePopover(
    {
      shouldUpdatePosition: false,
      offset: -60,
      isNonModal: true,
      popoverRef,
      triggerRef: buttonRef,
    },

    state,
  )

  const newPopoverprops = { ...popoverProps, style: undefined }

  //console.log(JSON.stringify({ overlayProps, popoverProps, newPopoverprops }, undefined, 2))

  return (
    <OverlayProvider>
      <OpenChatbotButton hide={shouldRender} triggerProps={triggerProps} ref={buttonRef} />
      {state.isOpen && (
        <FocusScope restoreFocus>
          <div
            {...mergeProps(overlayProps, newPopoverprops)}
            ref={popoverRef}
            aria-labelledby={chatbotTitleId}
            className={css`
              animation: ${state?.isOpen ? openAnimation : closeAnimation} 0.3s forwards;
              right: 1rem;
              width: ${CHATBOX_WIDTH_PX}px;
              max-width: 90vw;
              height: ${CHATBOX_HEIGHT_PX}px;
              max-height: 90vh;
              position: fixed;
              bottom: 4rem;
              right: 1rem;
              z-index: 1000;
            `}
            onAnimationEnd={handleAnimationEnd}
          >
            <ChatbotChat
              chatbotConfigurationId={chatbotConfigurationId}
              isCourseMaterialBlock={false}
              chatbotTitleId={chatbotTitleId}
              closeChatbot={() => state.setOpen(false)}
            />
          </div>
        </FocusScope>
      )}
    </OverlayProvider>
  )
}

export default React.memo(ChatbotDialog)
