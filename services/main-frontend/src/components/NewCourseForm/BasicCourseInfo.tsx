"use client"

import React, { useEffect } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TextArea, TextField } from "@/shared-module/components"
import { normalizePath } from "@/utils/normalizePath"

import type { FormFields } from "."
import { FieldContainer } from "."

interface BasicCourseInfoProps {
  form: UseFormReturn<FormFields>
}

const BasicCourseInfo: React.FC<BasicCourseInfoProps> = ({ form }) => {
  const { t } = useTranslation()
  const { control, watch, setValue } = form
  const name = watch("name")

  useEffect(() => {
    if (name) {
      setValue("slug", normalizePath(name))
    }
  }, [name, setValue])

  return (
    <>
      <FieldContainer>
        <TextField
          name="name"
          control={control}
          isRequired
          label={t("text-field-label-name")}
          rules={{
            required: t("required-field"),
            minLength: {
              value: 3,
              message: t("error-min-length", { count: 3, field: t("text-field-label-name") }),
            },
          }}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          name="slug"
          control={control}
          isRequired
          label={t("text-field-label-or-header-slug-or-short-name")}
          rules={{
            required: t("required-field"),
            pattern: {
              value: /^[a-z0-9-]+$/,
              message: t("invalid-url"),
            },
            minLength: {
              value: 3,
              message: t("error-min-length", {
                count: 3,
                field: t("text-field-label-or-header-slug-or-short-name"),
              }),
            },
          }}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          name="teacher_in_charge_name"
          control={control}
          isRequired
          label={t("teacher-in-charge-name")}
          rules={{
            required: t("required-field"),
            minLength: {
              value: 2,
              message: t("error-min-length", { count: 2, field: t("teacher-in-charge-name") }),
            },
          }}
        />
      </FieldContainer>
      <FieldContainer>
        <TextField
          name="teacher_in_charge_email"
          control={control}
          isRequired
          label={t("teacher-in-charge-email")}
          type="email"
          rules={{
            required: t("required-field"),
            pattern: {
              value: /@/,
              message: t("enter-a-valid-email"),
            },
          }}
        />
      </FieldContainer>
      <FieldContainer>
        <TextArea name="description" control={control} label={t("text-field-label-description")} />
      </FieldContainer>
    </>
  )
}

export default BasicCourseInfo
