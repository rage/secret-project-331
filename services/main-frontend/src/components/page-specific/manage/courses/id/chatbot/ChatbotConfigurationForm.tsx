import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

interface Props {
  closeEditor: () => void
}

const ChatbotConfigurationForm: React.FC<Props> = ({ closeEditor }) => {
  const { t } = useTranslation()

  return (
    <>
      <h1>{t("customize-chatbot")}</h1>
      <form>
        <Button type="submit" size="medium" variant="primary">
          {t("save")}
        </Button>
        <Button size="medium" variant="secondary" onClick={closeEditor}>
          {t("button-text-cancel")}
        </Button>
      </form>
    </>
  )
}

export default ChatbotConfigurationForm
