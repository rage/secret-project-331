import { css, keyframes } from "@emotion/css"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotDialogHeader from "./ChatbotDialogHeader"

import { baseTheme } from "@/shared-module/common/styles"

export interface ChatbotDialogProps {
  dialogOpen: boolean
  setDialogOpen: (dialogOpen: boolean) => void
  chatbotConfigurationId: string
}

const openAnimation = keyframes`
  from {
    transform: translateY(150%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`

const closeAnimation = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(150%);
    opacity: 0;
  }
`

const ChatbotDialog: React.FC<ChatbotDialogProps> = (props) => {
  const { dialogOpen, setDialogOpen, chatbotConfigurationId } = props
  const { t } = useTranslation()
  const [shouldRender, setShouldRender] = useState(dialogOpen)

  useEffect(() => {
    if (dialogOpen) {
      setShouldRender(true)
    }
  }, [dialogOpen])

  const handleAnimationEnd = () => {
    if (!dialogOpen) {
      setShouldRender(false)
    }
  }

  if (!shouldRender) {
    return null
  }

  return (
    <div
      className={css`
        width: 500px;
        max-width: 90vw;
        height: 600px;
        max-height: 90vh;
        position: fixed;
        bottom: 70px;
        right: 1rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0px 4px 10px rgba(177, 179, 184, 0.6);
        z-index: 1000;
        animation: ${dialogOpen ? openAnimation : closeAnimation} 0.3s forwards;
      `}
      aria-hidden={!dialogOpen}
      onAnimationEnd={handleAnimationEnd}
    >
      <ChatbotDialogHeader {...props} />
    </div>
  )
}

export default ChatbotDialog
