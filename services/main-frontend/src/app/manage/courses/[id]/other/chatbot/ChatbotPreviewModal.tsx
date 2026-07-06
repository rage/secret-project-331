"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()

  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, undefined)

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
