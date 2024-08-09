import { useState } from "react"

import ChatbotDialog from "./ChatbotDialog"
import OpenChatbotButton from "./OpenChatbotButton"

const Chatbot: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      {!dialogOpen && <OpenChatbotButton dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />}
      <ChatbotDialog dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />
    </>
  )
}

export default Chatbot
