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
  let buttonRef = useRef<HTMLButtonElement | null>(null)
  let popoverRef = useRef(null)
  const [shouldRender, setShouldRender] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  let state = {
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

  let dialogRef = useRef(null)
  // eslint-disable-next-line i18next/no-literal-string
  let { dialogProps, titleProps } = useDialog({ role: "dialog" }, dialogRef)
  dialogProps = { ...dialogProps, "aria-labelledby": chatbotTitleId }
  titleProps = { ...titleProps, id: chatbotTitleId }

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
              height: ${CHATBOX_HEIGHT_PX}px;
              max-height: 90vh;
              position: fixed;
              bottom: 4rem;
              right: 1rem;
              z-index: 1000;
            `}
            onAnimationEnd={handleAnimationEnd}
          >
            <div ref={dialogRef} {...dialogProps}>
              <ChatbotChat
                chatbotConfigurationId={chatbotConfigurationId}
                isCourseMaterialBlock={false}
                closeChatbot={() => state.setOpen(false)}
                titleProps={titleProps}
              />
            </div>
          </div>
        </FocusScope>
      )}
    </>
  )
}

export default React.memo(ChatbotDialog)
