import { css, keyframes } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotDialogBody from "./ChatbotDialogBody"
import ChatbotDialogHeader from "./ChatbotDialogHeader"

import { getChatbotCurrentConversationInfo } from "@/services/backend"
import { baseTheme } from "@/shared-module/common/styles"

export interface ChatbotDialogProps {
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
  chatbotConfigurationId: string
}

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
  const { dialogOpen, chatbotConfigurationId } = props
  const { t } = useTranslation()
  const [shouldRender, setShouldRender] = useState(dialogOpen)

  const currentConversationInfoQuery = useQuery({
    queryKey: ["currentConversationInfo", chatbotConfigurationId],
    queryFn: () => getChatbotCurrentConversationInfo(chatbotConfigurationId),
  })

  useEffect(() => {
    if (dialogOpen) {
      setShouldRender(true)
    }
  }, [dialogOpen])

  const handleAnimationEnd = () => {
    if (!dialogOpen) {
      setShouldRender(false)
    }
  }

  if (!shouldRender) {
    return null
  }

  return (
    <div
      className={css`
        width: 500px;
        max-width: 90vw;
        height: 600px;
        max-height: 90vh;
        position: fixed;
        bottom: 70px;
        right: 1rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0px 4px 10px rgba(177, 179, 184, 0.6);
        z-index: 1000;
        animation: ${dialogOpen ? openAnimation : closeAnimation} 0.3s forwards;

        display: flex;
        flex-direction: column;
      `}
      aria-hidden={!dialogOpen}
      onAnimationEnd={handleAnimationEnd}
    >
      <ChatbotDialogHeader {...props} currentConversationInfo={currentConversationInfoQuery.data} />
      <ChatbotDialogBody {...props} currentConversationInfo={currentConversationInfoQuery.data} />
    </div>
  )
}

export default ChatbotDialog
