import React from "react"
import { Dialog, DialogTrigger } from "react-aria-components"

import ChatbotDialog from "./ChatbotDialog"

export const CHATBOX_WIDTH_PX = 500
export const CHATBOX_HEIGHT_PX = 900

interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return (
    <DialogTrigger defaultOpen={false}>
      <Dialog>
        <ChatbotDialog
          chatbotConfigurationId={chatbotConfigurationId}
          isCourseMaterialBlock={false}
        />
      </Dialog>
    </DialogTrigger>
  )
}

export default React.memo(Chatbot)
