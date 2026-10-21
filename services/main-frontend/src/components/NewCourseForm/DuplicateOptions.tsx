"use client"

import React from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { Course } from "@/generated/api/types.generated"
import { useOrganizationDuplicatableCourses } from "@/hooks/useOrganizationDuplicatableCourses"
import { Checkbox, QueryResult, Select } from "@/shared-module/components"

import type { FormFields } from "."
import { FieldContainer } from "."
import LanguageVersionOptions from "./LanguageVersionOptions"

interface DuplicateOptionsProps {
  form: UseFormReturn<FormFields>
  organizationId: string
}

const DuplicateOptions: React.FC<DuplicateOptionsProps> = ({ form, organizationId }) => {
  const { t } = useTranslation()
  const { control, watch } = form
  const createDuplicate = watch("createDuplicate")
  const createAsLanguageVersion = watch("createAsLanguageVersion")

  const coursesQuery = useOrganizationDuplicatableCourses(organizationId)

  const renderDuplicateFields = (courses: Course[]) => (
    <>
      <FieldContainer>
        <Select
          name="courseId"
          control={control}
          label={t("course-where-to-copy-the-content")}
          id="duplicate-course-select-menu"
          options={courses.map((course) => {
            return { label: course.name, value: course.id }
          })}
        />
      </FieldContainer>
      <FieldContainer>
        <Checkbox
          name="createAsLanguageVersion"
          control={control}
          label={t("copied-course-is-a-language-version")}
        />
      </FieldContainer>
      {createAsLanguageVersion && (
        <div>
          <LanguageVersionOptions form={form} courses={courses} />
        </div>
      )}
      {!createAsLanguageVersion && (
        <FieldContainer>
          <Checkbox
            name="copy_user_permissions"
            control={control}
            label={t("grant-access-to-users-with-permissions-to-original-course")}
          />
        </FieldContainer>
      )}
    </>
  )

  return (
    <>
      <FieldContainer>
        <Checkbox name="createDuplicate" control={control} label={t("create-course-duplicate")} />
      </FieldContainer>
      {createDuplicate && (
        <div>
          <QueryResult query={coursesQuery} treatEmptyAsData>
            {(courses) => renderDuplicateFields(courses)}
          </QueryResult>
        </div>
      )}
    </>
  )
}

export default DuplicateOptions
