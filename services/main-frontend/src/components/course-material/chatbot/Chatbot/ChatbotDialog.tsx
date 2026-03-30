"use client"

import { css, keyframes } from "@emotion/css"
import React, { useEffect, useId, useRef, useState } from "react"
import {
  FocusScope,
  mergeProps,
  useDialog,
  useOverlay,
  useOverlayTrigger,
  usePopover,
} from "react-aria"

import OpenChatbotButton from "../Chatbot/OpenChatbotButton"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"
import { ChatbotStateAndData } from "../shared/hooks/useChatbotStateAndData"

interface ChatbotDialogProps {
  chatbotStateAndData: ChatbotStateAndData
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}
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

const ChatbotDialog: React.FC<ChatbotDialogProps> = (props) => {
  const { isOpen, setIsOpen } = props
  const chatbotTitleId = useId()
  const [shouldRender, setShouldRender] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef(null)

  const state = {
    isOpen,
    setOpen: (o: boolean) => {
      setIsOpen(o)
      if (!o) {
        buttonRef.current?.focus()
      }
    },
    open: () => {
      setIsOpen(true)
    },
    close: () => {
      // no operation prevents close on scroll
    },
    toggle: () => {
      setIsOpen(!isOpen)
      if (isOpen) {
        buttonRef.current?.focus()
      }
    },
  }
  let { triggerProps, overlayProps } = useOverlayTrigger({ type: "dialog" }, state, buttonRef)
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

  let newPopoverProps = { ...popoverProps, style: undefined }
  let { overlayProps: overlayProps2 } = useOverlay(
    {
      onClose: () => {
        state.setOpen(false)
      },
      isOpen: state.isOpen,
      isDismissable: false,
    },
    popoverRef,
  )

  const dialogRef = useRef(null)
  // eslint-disable-next-line i18next/no-literal-string
  let { dialogProps, titleProps } = useDialog({ role: "dialog" }, dialogRef)
  dialogProps = { ...dialogProps, "aria-labelledby": chatbotTitleId }
  titleProps = { ...titleProps, id: chatbotTitleId }

  useEffect(() => {
    if (state?.isOpen) {
      setShouldRender(true)
    }
  }, [state?.isOpen, setShouldRender])

  const handleAnimationEnd = () => {
    if (!state?.isOpen) {
      setShouldRender(false)
    }
  }

  return (
    <>
      <OpenChatbotButton hide={shouldRender} triggerProps={triggerProps} ref={buttonRef} />
      {shouldRender && (
        <FocusScope restoreFocus>
          <div
            {...mergeProps(overlayProps, newPopoverProps, overlayProps2)}
            ref={popoverRef}
            className={css`
              animation: ${state?.isOpen ? openAnimation : closeAnimation} 0.3s forwards;
              right: 1rem;
              width: ${CHATBOX_WIDTH_PX}px;
              max-width: 90vw;
              min-height: 60vh;
              height: fit-content;
              max-height: 90vh;
              position: fixed;
              bottom: 4rem;
              z-index: 1000;
            `}
            onAnimationEnd={handleAnimationEnd}
          >
            <div
              ref={dialogRef}
              className={css`
                width: inherit;
                max-width: inherit;
                min-width: inherit;
                height: inherit;
                max-height: inherit;
                min-height: inherit;
                background: white;
                border-radius: 10px;
                box-shadow: 0px 4px 10px rgba(177, 179, 184, 0.6);
                z-index: 1000;
                display: flex;
                flex-direction: column;
              `}
              {...dialogProps}
            >
              <ChatbotChatHeader
                currentConversationInfo={props.chatbotStateAndData.currentConversationInfo}
                newConversationMutation={props.chatbotStateAndData.newConversationMutation}
                titleProps={titleProps}
                isCourseMaterialBlock={false}
                closeChatbot={() => state.setOpen(false)}
              />
              <ChatbotChatBody {...props.chatbotStateAndData} />
            </div>
          </div>
        </FocusScope>
      )}
    </>
  )
}

export default React.memo(ChatbotDialog)
