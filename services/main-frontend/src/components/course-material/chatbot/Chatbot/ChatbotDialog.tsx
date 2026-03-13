"use client"

import { css, keyframes } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import React, { RefObject, useEffect, useId, useRef } from "react"
import {
  FocusScope,
  mergeProps,
  useDialog,
  useOverlay,
  useOverlayTrigger,
  usePopover,
} from "react-aria"

import { ChatbotState, MessageAction, MessageState } from "../shared/ChatbotChat"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"

import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"

type DOMPropsType = ReturnType<typeof useOverlayTrigger>["overlayProps"]

interface ChatbotDialogProps {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  state: ChatbotState
  buttonRef: RefObject<HTMLButtonElement | null>
  shouldRender: boolean
  setShouldRender: (value: React.SetStateAction<boolean>) => void
  messageState: MessageState
  dispatch: (action: MessageAction) => void
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: Error | null
  setError: (value: React.SetStateAction<Error | null>) => void
  overlayProps: DOMPropsType
  chatbotMessageAnnouncement: string
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
  newConversation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
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
  let { state, buttonRef, shouldRender, setShouldRender, overlayProps } = props
  const chatbotTitleId = useId()
  const popoverRef = useRef(null)

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
                bottom: 70px;
                right: 1rem;
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
                {...props}
                titleProps={titleProps}
                isCourseMaterialBlock={false}
                closeChatbot={() => state.setOpen(false)}
              />
              <ChatbotChatBody {...props} />
            </div>
          </div>
        </FocusScope>
      )}
    </>
  )
}

export default React.memo(ChatbotDialog)
