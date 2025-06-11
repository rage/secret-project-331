import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface CreateChatbotProps {
  onCreateNewChatbot: (bot: NewChatbotConf) => void // wrap for validation
  courseId: string
}

interface CreateChatbotFields {
  name: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({ onCreateNewChatbot, courseId }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    watch,
    setError,
  } = useForm<CreateChatbotFields>()

  const onCreateNewChatbotWrapper = handleSubmit((data) => {
    onCreateNewChatbot({
      chatbot_name: "",
    })
  })

  return (
    <div>
      <h1>#</h1>
      <form onSubmit={onCreateNewChatbotWrapper}>
        <TextField id="name" label={t("label-name")} />
        <Button type="submit" size="medium" variant="primary">
          {t("save")}
        </Button>
      </form>
    </div>
  )
}

export default CreateChatbotForm
