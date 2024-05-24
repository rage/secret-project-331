import React from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"
import FileField from "@/shared-module/common/components/InputFields/FileField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface Props {
  closeEditor: () => void
}

const ChatbotConfigurationForm: React.FC<Props> = ({ closeEditor }) => {
  const { t } = useTranslation()

  return (
    <>
      <h1>{t("customize-chatbot")}</h1>
      <form>
        <TextField label="Name of the chatbot" />
        <FileField label="Image" />
        <TextAreaField label="Prompt" rows={15} />
        <TextAreaField label="First message" rows={3} />
        <TextField label="Daily tokens per user" type="number" />
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
