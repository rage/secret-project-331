import React, { useId } from "react"
import { Dialog, DialogTrigger } from "react-aria-components"

import ChatbotDialog from "./ChatbotDialog"

export const CHATBOX_WIDTH_PX = 500
export const CHATBOX_HEIGHT_PX = 900

interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const chatbotTitleId = useId()

  return (
    <DialogTrigger defaultOpen={false}>
      <Dialog aria-labelledby={chatbotTitleId}>
        <ChatbotDialog
          chatbotConfigurationId={chatbotConfigurationId}
          isCourseMaterialBlock={false}
          chatbotTitleId={chatbotTitleId}
        />
      </Dialog>
    </DialogTrigger>
  )
}

export default React.memo(Chatbot)
