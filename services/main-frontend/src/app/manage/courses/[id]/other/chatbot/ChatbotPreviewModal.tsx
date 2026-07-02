"use client"

import { t } from "i18next"

import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
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
  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, undefined)

  return (
    <div>
      <StandardDialog open={open} onClose={onClose} title={t("chatbot-preview-modal-title")}>
        <ChatbotChatBox {...chatbotStateAndData} />
      </StandardDialog>
    </div>
  )
}

export default ChatbotPreviewModal
