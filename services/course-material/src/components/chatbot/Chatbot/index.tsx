import React from "react"
import { DialogTrigger } from "react-aria-components"

import ChatbotDialog from "./ChatbotDialog"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return (
    <DialogTrigger defaultOpen={false}>
      <ChatbotDialog chatbotConfigurationId={chatbotConfigurationId} />
    </DialogTrigger>
  )
}

export default React.memo(Chatbot)
