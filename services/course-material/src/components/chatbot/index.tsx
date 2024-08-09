import { useState } from "react"

import ChatbotDialog from "./ChatbotDialog"
import OpenChatbotButton from "./OpenChatbotButton"

interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = () => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      {!dialogOpen && <OpenChatbotButton dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />}
      <ChatbotDialog dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />
    </>
  )
}

export default Chatbot
