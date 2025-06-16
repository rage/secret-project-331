import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface CreateChatbotProps {
  onCreateNewChatbot: (bot: NewChatbotConf) => void
}

interface CreateChatbotFields {
  name: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({ onCreateNewChatbot }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateChatbotFields>()

  const onCreateNewChatbotWrapper = handleSubmit((data) => {
    onCreateNewChatbot({
      chatbot_name: data.name,
    })
  })

  return (
    <div>
      <form onSubmit={onCreateNewChatbotWrapper}>
        <TextField
          id={"name"}
          error={errors.name?.message}
          label={t("label-name")}
          {...register("name", { required: t("required-field") })}
        />
        <Button type="submit" size="medium" variant="primary">
          {t("save")}
        </Button>
      </form>
    </div>
  )
}

export default CreateChatbotForm
