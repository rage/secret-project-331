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

import { useToggleFocus } from "@/shared-module/components"

import OpenChatbotButton from "../Chatbot/OpenChatbotButton"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"
import { useChatbotContext } from "../shared/ChatbotContext"

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

const ChatbotDialog: React.FC = () => {
  const chatbotTitleId = useId()
  const [shouldRender, setShouldRender] = useState(false)
  const popoverRef = useRef(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Focus the dialog once mounted; on close, wait until the trigger is visible again.
  const buttonRef = useToggleFocus(shouldRender, () => dialogRef.current?.focus())

  const { isOpen, setDialogOpen } = useChatbotContext()

  const state = {
    isOpen,
    setOpen: (o: boolean) => {
      setDialogOpen?.(o)
    },
    open: () => {
      setDialogOpen?.(true)
    },
    close: () => {
      // no operation prevents close on scroll
    },
    toggle: () => {
      setDialogOpen?.(!isOpen)
    },
    // The dialog is anchored to the button, so OverlayTriggerState's cursor position goes unused.
    point: null,
    setPoint: () => {
      // no operation
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

  // oxlint-disable-next-line i18next/no-literal-string
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
                titleProps={titleProps}
                isAlwaysOpen={false}
                closeChatbot={() => state.setOpen(false)}
              />
              <ChatbotChatBody />
            </div>
          </div>
        </FocusScope>
      )}
    </>
  )
}

export default React.memo(ChatbotDialog)
