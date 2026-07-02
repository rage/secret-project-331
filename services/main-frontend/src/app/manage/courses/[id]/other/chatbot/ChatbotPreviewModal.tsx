"use client"

import { t } from "i18next"

import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import useDefaultChatbotConfiguration from "@/hooks/course-material/useDefaultChatbotConfiguration"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

const ChatbotPreviewModal = ({ open, onClose, courseId }) => {
  const chatbotConfiguration = useDefaultChatbotConfiguration(courseId)
  const chatbotConfigurationId = chatbotConfiguration.data

  const chatbotStateAndData = useChatbotStateAndData(
    chatbotConfigurationId!,
    //isCourseMaterialBlock ? undefined : setIsOpen,
    undefined,
  )

  // täytyy luoda uusi keskustelu jotta toimii

  return (
    <div>
      <StandardDialog open={open} onClose={onClose} title={t("chatbot-preview-modal-title")}>
        <ChatbotChatBox {...chatbotStateAndData} />
      </StandardDialog>
    </div>
  )
}

export default ChatbotPreviewModal
