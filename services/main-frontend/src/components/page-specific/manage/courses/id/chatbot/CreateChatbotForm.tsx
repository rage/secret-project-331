import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewChatbotConf } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface CreateChatbotProps {
  onCreateNewChatbot: (bot: NewChatbotConf) => void // wrap for validation
  courseId: string
  chatbotName: string | null
}

interface CreateChatbotFields {
  name: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({
  onCreateNewChatbot,
  courseId,
  chatbotName,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    watch,
    setError,
  } = useForm<CreateChatbotFields>()

  /*   const validateForm = (data: CreateChatbotFields): boolean => {
    // not needed
    let isValid = true
    clearErrors(["name"])

    if (data.name.length < 1) {
      setError("name", {
        message: t("error-min-length", { count: 1, field: t("text-field-label-name") }),
      })
      isValid = false
    }
    return isValid
  } */

  const onCreateNewChatbotWrapper = handleSubmit((data) => {
    /*     if (!validateForm(data)) {
      return
    } */
    onCreateNewChatbot({
      chatbot_name: data.name,
    })
  })

  return (
    <div>
      <h1>#</h1>
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
