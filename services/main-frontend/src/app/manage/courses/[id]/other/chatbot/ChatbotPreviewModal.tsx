"use client"

import { css } from "@emotion/css"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

interface ChatbotPreviewModalProps {
  open: boolean
  onClose: () => void
  chatbotConfigurationId: string
}

const ChatbotPreviewModal: React.FC<ChatbotPreviewModalProps> = ({
  open,
  onClose,
  chatbotConfigurationId,
}) => {
  const { t } = useTranslation()

  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, undefined)
  const { currentConversationInfo, newConversationMutation } = chatbotStateAndData
  const hasStartedFreshConversation = useRef(false)

  // When the preview opens, start a fresh conversation if one already exists so the preview
  // reflects the just-saved configuration. Runs once, after the current conversation is known.
  useEffect(() => {
    if (hasStartedFreshConversation.current || currentConversationInfo.isPending) {
      return
    }
    hasStartedFreshConversation.current = true
    if (currentConversationInfo.data?.current_conversation) {
      void newConversationMutation.mutateAsync()
    }
  }, [currentConversationInfo.isPending, currentConversationInfo.data, newConversationMutation])

  return (
    <div>
      <StandardDialog open={open} onClose={onClose} title={t("chatbot-preview-modal-title")}>
        <div
          className={css`
            height: 75vh;
          `}
        >
          <ChatbotChatBox {...chatbotStateAndData} />
        </div>
      </StandardDialog>
    </div>
  )
}

export default ChatbotPreviewModal
