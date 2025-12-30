import React from "react"

import ChatbotDialog from "./ChatbotDialog"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return <ChatbotDialog chatbotConfigurationId={chatbotConfigurationId} />
}

export default React.memo(Chatbot)
