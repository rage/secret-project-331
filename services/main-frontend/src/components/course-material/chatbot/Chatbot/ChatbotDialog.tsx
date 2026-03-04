"use client"

import { css, keyframes } from "@emotion/css"
import { useAtom, useSetAtom } from "jotai"
import React, { useEffect, useId, useReducer, useRef, useState } from "react"
import {
  FocusScope,
  mergeProps,
  useDialog,
  useOverlay,
  useOverlayTrigger,
  usePopover,
} from "react-aria"
import { useTranslation } from "react-i18next"

import ChatbotChat from "./ChatbotChat"
import OpenChatbotButton from "./OpenChatbotButton"

import { ChatbotProps } from "."

import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { sendChatbotMessage } from "@/services/course-material/backend"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  chatbotOpenAtom,
  defaultChatbotCommunicationChannel,
} from "@/stores/course-material/chatbotDialogStore"

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

export interface MessageState {
  optimisticMessage: string | null
  streamingMessage: string | null
}

export type MessageAction =
  | { type: "SET_OPTIMISTIC_MESSAGE"; payload: string | null }
  | { type: "APPEND_STREAMING_MESSAGE"; payload: string }
  | { type: "RESET_MESSAGES" }

const messageReducer = (state: MessageState, action: MessageAction): MessageState => {
  switch (action.type) {
    case "SET_OPTIMISTIC_MESSAGE":
      return { ...state, optimisticMessage: action.payload }
    case "APPEND_STREAMING_MESSAGE":
      return { ...state, streamingMessage: (state.streamingMessage || "") + action.payload }
    case "RESET_MESSAGES":
      return { optimisticMessage: null, streamingMessage: null }
    default:
      return state
  }
}

const ChatbotDialog: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const chatbotTitleId = useId()
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef(null)
  const [shouldRender, setShouldRender] = useState(false)
  const [isOpen, setIsOpen] = useAtom(chatbotOpenAtom)
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
  })
  const setSendNewMessage = useSetAtom(defaultChatbotCommunicationChannel)

  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)

  const currentConversationInfoQuery = useCurrentConversationInfo(chatbotConfigurationId)

  const newMessageMutation = useToastMutation(
    async (messageToSend: string) => {
      setChatbotMessageAnnouncement("")
      if (!currentConversationInfoQuery.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = messageToSend.trim()
      dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: message })
      const stream = await sendChatbotMessage(
        chatbotConfigurationId,
        currentConversationInfoQuery.data.current_conversation.id,
        message,
      )
      const reader = stream.getReader()

      let done = false
      while (!done) {
        const { done: doneReading, value } = await reader.read()
        done = doneReading
        if (value) {
          const valueAsString = new TextDecoder().decode(value)
          const lines = valueAsString.split("\n")
          for (const line of lines) {
            if (line?.indexOf("{") !== 0) {
              continue
            }
            try {
              const parsedValue = JSON.parse(line)
              if (parsedValue.text) {
                dispatch({ type: "APPEND_STREAMING_MESSAGE", payload: parsedValue.text })
              }
            } catch (e) {
              console.error(e)
            }
          }
        }
      }
      return stream
    },
    { notify: false },
    {
      onSuccess: async () => {
        await currentConversationInfoQuery.refetch()
        dispatch({ type: "RESET_MESSAGES" })
        setError(null)
        setChatbotMessageAnnouncement(t("chatbot-finished-responding"))
      },
      onError: async (error) => {
        if (error instanceof Error) {
          setError(error)
          dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: null })
        } else {
          console.error(`Failed to send chat message: ${error}`)
          setError(new Error("Unknown error occurred"))
        }
        await currentConversationInfoQuery.refetch()
      },
    },
  )

  useEffect(() => {
    setSendNewMessage({
      newMessageMutation: newMessageMutation,
    })
    return () => setSendNewMessage(null)
  })

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

  const dialogRef = useRef(null)
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
              `}
              {...dialogProps}
            >
              <ChatbotChat
                chatbotConfigurationId={chatbotConfigurationId}
                currentConversationInfo={currentConversationInfoQuery}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                error={error}
                setError={setError}
                isCourseMaterialBlock={false}
                closeChatbot={() => state.setOpen(false)}
                titleProps={titleProps}
                chatbotMessageAnnouncement={chatbotMessageAnnouncement}
                dispatch={dispatch}
                messageState={messageState}
                newMessageMutation={newMessageMutation}
              />
            </div>
          </div>
        </FocusScope>
      )}
    </>
  )
}

export default React.memo(ChatbotDialog)
