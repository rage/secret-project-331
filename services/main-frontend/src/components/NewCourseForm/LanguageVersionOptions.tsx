"use client"

import React from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { FieldContainer, FormFields } from "."

import { Course } from "@/shared-module/common/bindings"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"

interface LanguageVersionOptionsProps {
  form: UseFormReturn<FormFields>
  courses?: Course[]
}

const LanguageVersionOptions: React.FC<LanguageVersionOptionsProps> = ({ form, courses }) => {
  const { t } = useTranslation()
  const { register, watch } = form
  const useExistingLanguageGroup = watch("useExistingLanguageGroup")

  return (
    <>
      <FieldContainer>
        <CheckBox
          label={t("resulting-course-should-be-a-language-version-of-a-different-course")}
          {...register("useExistingLanguageGroup")}
        ></CheckBox>
      </FieldContainer>
      {useExistingLanguageGroup && (
        <FieldContainer>
          <SelectField
            required
            label={t("target-course")}
            {...register("targetCourseId")}
            options={
              courses?.map((course) => {
                return { label: course.name, value: course.id }
              }) || []
            }
          />
        </FieldContainer>
      )}
      <FieldContainer>
        <CheckBox
          label={t("grant-access-to-users-with-permissions-to-original-course")}
          {...register("copy_user_permissions")}
        ></CheckBox>
      </FieldContainer>
    </>
  )
}

export default LanguageVersionOptions
