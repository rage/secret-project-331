"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  deleteGlossaryTermMutation,
  updateGlossaryTermMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { Term as GlossaryTerm } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import {
  Button,
  itemHeadingProps,
  TextArea,
  TextField,
  useDialog,
  useToggleFocus,
} from "@/shared-module/components"

const entryCss = css`
  display: grid;
  gap: var(--space-4);
`

/** A term names one entry in the list, so it stays well under the page title. */
const termCss = css`
  margin: 0;
  font-size: var(--font-size-4);
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`

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
  /** Called once a delete succeeds, before the refetch, so the list can move focus once it is gone. */
  onBeforeDelete?: (headingId: string) => void
}

const TermItem: React.FC<TermItemProps> = ({
  term,
  isEditing,
  onEdit,
  onCancel,
  refetch,
  onBeforeDelete,
}) => {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const headingId = `term-heading-${term.id}`
  const {
    control,
    handleSubmit,
    formState: { isValid },
    reset,
    setFocus,
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

  // oxlint-disable-next-line i18next/no-literal-string
  const editButtonRef = useToggleFocus(isEditing, () => setFocus("updatedTerm"))

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
    {
      onSuccess: () => {
        // Only a delete that succeeded moves focus; the heading is still in the list here.
        onBeforeDelete?.(headingId)
        refetch()
      },
    },
  )

  const onDelete = async () => {
    const confirmed = await confirm({
      title: t("delete-term-named", { term: term.term, name: term.term }),
      message: t("confirm-delete-term", {
        term: term.term,
        defaultValue: "Delete the term {{term}} from the glossary?",
      }),
      confirmLabel: t("button-text-delete"),
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }
    deleteMutation.mutate({ path: { term_id: term.id } })
  }

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
    <li>
      {isEditing ? (
        <form onSubmit={handleSubmit(onUpdate)} className={entryCss}>
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
          <div className={actionsCss}>
            <Button variant="primary" size="medium" type="submit" disabled={!isValid}>
              {t("button-text-save")}
            </Button>
            <Button variant="tertiary" size="medium" type="button" onClick={onCancel}>
              {t("button-text-cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className={entryCss}>
          <h2 id={headingId} {...itemHeadingProps} className={termCss}>
            {term.term}
          </h2>
          <p>{term.definition}</p>
          <div className={actionsCss}>
            <Button
              ref={editButtonRef}
              variant="primary"
              size="medium"
              onClick={onEdit}
              aria-label={t("edit-term-named", {
                term: term.term,
                defaultValue: "Edit term {{term}}",
              })}
            >
              {t("edit")}
            </Button>
            <Button
              variant="tertiary"
              size="medium"
              onClick={onDelete}
              disabled={deleteMutation.isPending}
              aria-label={t("delete-term-named", { term: term.term, name: term.term })}
            >
              {t("button-text-delete")}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export default TermItem
