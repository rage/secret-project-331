"use client"

import { css } from "@emotion/css"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createEmailTemplateMutation,
  getEmailTemplatesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type { EmailTemplateType } from "@/generated/api/types.generated"
import { Button, Dialog, Infobox, Select, TextField, TONE } from "@/shared-module/components"

interface Fields {
  templateType: EmailTemplateType | ""
  language: string
  subject: string
}

const DEFAULT_VALUES: Fields = { templateType: "", language: "", subject: "" }

const formCss = css`
  display: grid;
  gap: var(--space-4);
`

const LANGUAGE_CODES = ["en", "fi", "sv"] as const

const LANGUAGE_LABEL_KEYS = {
  en: "english",
  fi: "finnish",
  sv: "swedish",
} as const satisfies Record<(typeof LANGUAGE_CODES)[number], string>

interface AddEmailTemplateDialogProps {
  templateTypeOptions: readonly { value: EmailTemplateType; label: string }[]
}

/** Creates a global email template and continues to its CMS editor. */
const AddEmailTemplateDialog: React.FC<AddEmailTemplateDialogProps> = ({ templateTypeOptions }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { control, handleSubmit, reset } = useForm<Fields>({ defaultValues: DEFAULT_VALUES })

  const mutation = useMutation({
    ...createEmailTemplateMutation(),
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: getEmailTemplatesQueryKey() })
      window.location.assign(`/cms/email-templates/${template.id}/edit`)
    },
  })

  const close = () => {
    setOpen(false)
    reset(DEFAULT_VALUES)
    mutation.reset()
  }

  const submit = handleSubmit((fields) => {
    if (fields.templateType === "") {
      return
    }
    mutation.mutate({
      body: {
        template_type: fields.templateType,
        language: fields.language,
        subject: fields.subject.trim() || null,
        content: null,
      },
    })
  })

  return (
    <>
      <Button variant="primary" size="medium" onClick={() => setOpen(true)}>
        {t("button-text-add-email-template")}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t("title-add-email-template")}
        actions={[
          { label: t("button-text-cancel"), variant: "tertiary", onPress: close },
          {
            label: t("button-text-create"),
            variant: "primary",
            isLoading: mutation.isPending,
            onPress: () => void submit(),
          },
        ]}
      >
        <form onSubmit={submit} className={formCss} noValidate>
          <Select
            name="templateType"
            control={control}
            label={t("label-template-type")}
            rules={{ required: t("required-field") }}
            options={templateTypeOptions}
          />
          <Select
            name="language"
            control={control}
            label={t("label-language")}
            rules={{ required: t("required-field") }}
            options={LANGUAGE_CODES.map((code) => ({
              value: code,
              label: t(LANGUAGE_LABEL_KEYS[code]),
            }))}
          />
          <TextField name="subject" control={control} label={t("label-email-subject")} />
          {mutation.isError && <Infobox tone={TONE.DANGER}>{mutation.error.message}</Infobox>}
        </form>
      </Dialog>
    </>
  )
}

export default AddEmailTemplateDialog
