import { css, keyframes } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { OverlayTriggerStateContext } from "react-aria-components"

import ChatbotDialogBody from "../shared/ChatbotDialogBody"
import ChatbotDialogHeader from "../shared/ChatbotDialogHeader"

import OpenChatbotButton from "./OpenChatbotButton"

import { CHATBOX_HEIGHT_PX, CHATBOX_WIDTH_PX } from "."

import useNewConversationMutation from "@/hooks/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/chatbot/useCurrentConversationInfo"

interface ChatbotDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: false
}

interface ChatbotNoDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: true
}

export type DiscrChatbotDialogProps = ChatbotDialogProps | ChatbotNoDialogProps

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
  const { chatbotConfigurationId } = props
  let dialogState = React.useContext(OverlayTriggerStateContext)
  const [shouldRender, setShouldRender] = useState(dialogState?.isOpen)

  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)

  const currentConversationInfoQuery = useCurrentConversationInfo(chatbotConfigurationId)
  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfoQuery,
    setNewMessage,
    setError,
  )

  useEffect(() => {
    if (dialogState?.isOpen) {
      setShouldRender(true)
    }
  }, [dialogState?.isOpen])

  const handleAnimationEnd = () => {
    if (!dialogState?.isOpen) {
      setShouldRender(false)
    }
  }

  if (!shouldRender) {
    return <OpenChatbotButton />
  }

  return (
    <div
      className={css`
        width: ${CHATBOX_WIDTH_PX}px;
        max-width: 90vw;
        height: ${CHATBOX_HEIGHT_PX}px;
        max-height: 90vh;
        position: fixed;
        bottom: 70px;
        right: 1rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0px 4px 10px rgba(177, 179, 184, 0.6);
        z-index: 1000;
        animation: ${dialogState?.isOpen ? openAnimation : closeAnimation} 0.3s forwards;

        display: flex;
        flex-direction: column;
      `}
      onAnimationEnd={handleAnimationEnd}
    >
      <ChatbotDialogHeader
        {...props}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        isCourseMaterialBlock={false}
      />
      <ChatbotDialogBody
        {...props}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        error={error}
        setError={setError}
      />
    </div>
  )
}

export default ChatbotDialog
