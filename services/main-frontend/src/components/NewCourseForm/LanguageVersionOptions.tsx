"use client"

import React from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { Course } from "@/generated/api/types.generated"
import { Checkbox, Select } from "@/shared-module/components"

import type { FormFields } from "."
import { FieldContainer } from "."

interface LanguageVersionOptionsProps {
  form: UseFormReturn<FormFields>
  courses?: Course[]
}

const LanguageVersionOptions: React.FC<LanguageVersionOptionsProps> = ({ form, courses }) => {
  const { t } = useTranslation()
  const { control, watch } = form
  const useExistingLanguageGroup = watch("useExistingLanguageGroup")

  return (
    <>
      <FieldContainer>
        <Checkbox
          name="useExistingLanguageGroup"
          control={control}
          label={t("resulting-course-should-be-a-language-version-of-a-different-course")}
        />
      </FieldContainer>
      {useExistingLanguageGroup && (
        <FieldContainer>
          <Select
            name="targetCourseId"
            control={control}
            isRequired
            label={t("target-course")}
            options={
              courses?.map((course) => {
                return { label: course.name, value: course.id }
              }) || []
            }
          />
        </FieldContainer>
      )}
      <FieldContainer>
        <Checkbox
          name="copy_user_permissions"
          control={control}
          label={t("grant-access-to-users-with-permissions-to-original-course")}
        />
      </FieldContainer>
    </>
  )
}

export default LanguageVersionOptions
