"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createCourseChatbotMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { ChatbotConfiguration } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

interface CreateChatbotProps {
  courseId: string
  getChatbotsList: UseQueryResult<ChatbotConfiguration[], unknown>
  closeEdit: (url_id: string) => void
}

interface CreateChatbotFields {
  name: string
}

const CreateChatbotForm: React.FC<CreateChatbotProps> = ({
  courseId,
  getChatbotsList,
  closeEdit,
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateChatbotFields>()

  const createChatbotMutation = useToastMutationOptions(
    createCourseChatbotMutation(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: (data) => {
        getChatbotsList.refetch()
        closeEdit(data.id)
      },
    },
  )

  return (
    <div>
      <form
        onSubmit={handleSubmit((data) => {
          createChatbotMutation.mutate({
            body: data.name.trim(),
            path: {
              course_id: courseId,
            },
          })
        })}
      >
        <TextField
          error={errors.name?.message}
          label={t("label-name")}
          {...register("name", {
            required: t("required-field"),
            validate: {
              check: (name) => {
                return name.trim() ? true : t("name-not-empty")
              },
            },
          })}
        />
        <Button
          type="submit"
          size="medium"
          variant="primary"
          disabled={createChatbotMutation.isPending}
        >
          {t("save")}
        </Button>
      </form>
    </div>
  )
}

export default CreateChatbotForm
