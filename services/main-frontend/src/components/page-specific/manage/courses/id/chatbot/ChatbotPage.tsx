import { css } from "@emotion/css"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotConfigurationForm from "./ChatbotConfigurationForm"

import Button from "@/shared-module/common/components/Button"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"

const ChatBotPage = () => {
  const { t } = useTranslation()

  const [customizeChatbotVisible, setCustomizeChatbotVisible] = useState(false)

  if (customizeChatbotVisible) {
    return (
      <>
        <ChatbotConfigurationForm
          closeEditor={() => {
            setCustomizeChatbotVisible(false)
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("chatbot")}
      </h1>

      <Button
        size="medium"
        variant="secondary"
        onClick={() => {
          setCustomizeChatbotVisible(true)
        }}
      >
        {t("customize-chatbot")}
      </Button>
    </>
  )
}

export default ChatBotPage
