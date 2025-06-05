import React, { useState } from "react"

import ChatbotDialog from "./ChatbotDialog"
import OpenChatbotButton from "./OpenChatbotButton"

export const CHATBOX_WIDTH_PX = 500
export const CHATBOX_HEIGHT_PX = 700

interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      {!dialogOpen && <OpenChatbotButton setDialogOpen={setDialogOpen} />}
      <ChatbotDialog
        chatbotConfigurationId={chatbotConfigurationId}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
      />
    </>
  )
}

export default React.memo(Chatbot)
