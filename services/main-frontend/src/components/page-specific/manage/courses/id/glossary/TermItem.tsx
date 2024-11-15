import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { deleteTerm, updateTerm } from "@/services/backend/glossary"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface GlossaryTerm {
  id: string
  term: string
  definition: string
}

interface UpdateTermForm {
  updatedTerm: string
  updatedDefinition: string
}

interface TermItemProps {
  term: GlossaryTerm
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  refetch: () => void
}

const TermItem: React.FC<TermItemProps> = ({ term, isEditing, onEdit, onCancel, refetch }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<UpdateTermForm>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      updatedTerm: term.term,
      updatedDefinition: term.definition,
    },
  })

  useEffect(() => {
    reset({
      updatedTerm: term.term,
      updatedDefinition: term.definition,
    })
  }, [term, reset])

  const updateMutation = useToastMutation(
    (data: UpdateTermForm) => updateTerm(term.id, data.updatedTerm, data.updatedDefinition),
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: () => {
        onCancel()
        refetch()
      },
    },
  )

  const deleteMutation = useToastMutation(
    () => deleteTerm(term.id),
    {
      notify: true,
      method: "DELETE",
    },
    { onSuccess: () => refetch() },
  )

  const onUpdate = (data: UpdateTermForm) => {
    updateMutation.mutate(data)
  }

  return (
    <div>
      <hr />
      {isEditing ? (
        <form onSubmit={handleSubmit(onUpdate)}>
          <TextField
            placeholder={t("updated-term")}
            label={t("updated-term")}
            {...register("updatedTerm", {
              required: true,
              pattern: {
                value: /\S+/,
                message: t("required"),
              },
            })}
            error={errors.updatedTerm && t("required")}
          />
          <TextAreaField
            label={t("updated-definition")}
            placeholder={t("updated-definition")}
            {...register("updatedDefinition", {
              required: true,
              pattern: {
                value: /\S+/,
                message: t("required"),
              },
            })}
            error={errors.updatedDefinition && t("required")}
            disabled={false}
          />
          <Button variant="primary" size="medium" type="submit" disabled={!isValid}>
            {t("button-text-save")}
          </Button>
          <Button variant="tertiary" size="medium" type="button" onClick={onCancel}>
            {t("button-text-cancel")}
          </Button>
        </form>
      ) : (
        <>
          <div>{term.term}</div>
          <div>{term.definition}</div>
          <Button variant="primary" size="medium" onClick={onEdit}>
            {t("edit")}
          </Button>
          <Button
            variant="tertiary"
            size="medium"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {t("button-text-delete")}
          </Button>
        </>
      )}
    </div>
  )
}

export default TermItem
