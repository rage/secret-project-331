"use client"

import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  deleteGlossaryTermMutation,
  updateGlossaryTermMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { Term as GlossaryTerm } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, TextArea, TextField } from "@/shared-module/components"

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
    control,
    handleSubmit,
    formState: { isValid },
    reset,
  } = useForm<UpdateTermForm>({
    // oxlint-disable-next-line i18next/no-literal-string
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

  const updateMutation = useToastMutationOptions(
    updateGlossaryTermMutation(),
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

  const deleteMutation = useToastMutationOptions(
    deleteGlossaryTermMutation(),
    {
      notify: true,
      method: "DELETE",
    },
    { onSuccess: () => refetch() },
  )

  const onUpdate = (data: UpdateTermForm) => {
    updateMutation.mutate({
      body: {
        definition: data.updatedDefinition,
        term: data.updatedTerm,
      },
      path: {
        term_id: term.id,
      },
    })
  }

  return (
    <div>
      <hr />
      {isEditing ? (
        <form onSubmit={handleSubmit(onUpdate)}>
          <TextField
            name="updatedTerm"
            control={control}
            label={t("updated-term")}
            rules={{
              required: true,
              pattern: {
                value: /\S+/,
                message: t("required"),
              },
            }}
          />
          <TextArea
            name="updatedDefinition"
            control={control}
            label={t("updated-definition")}
            rules={{
              required: true,
              pattern: {
                value: /\S+/,
                message: t("required"),
              },
            }}
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
            onClick={() =>
              deleteMutation.mutate({
                path: {
                  term_id: term.id,
                },
              })
            }
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
