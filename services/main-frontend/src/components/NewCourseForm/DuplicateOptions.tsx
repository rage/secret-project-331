import React from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import LanguageVersionOptions from "./LanguageVersionOptions"

import { FieldContainer, FormFields } from "."

import { useOrganizationDuplicatableCourses } from "@/hooks/useOrganizationDuplicatableCourses"
import { Course } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import Spinner from "@/shared-module/common/components/Spinner"

interface DuplicateOptionsProps {
  form: UseFormReturn<FormFields>
  organizationId: string
}

const DuplicateOptions: React.FC<DuplicateOptionsProps> = ({ form, organizationId }) => {
  const { t } = useTranslation()
  const { register, watch } = form
  const createDuplicate = watch("createDuplicate")
  const createAsLanguageVersion = watch("createAsLanguageVersion")

  const coursesQuery = useOrganizationDuplicatableCourses(organizationId)
  const courses = coursesQuery.data
  const isLoading = coursesQuery.isLoading
  const error = coursesQuery.error

  const handleDuplicateMenu = (courseId: string) => {
    const findCourse = courses?.find((course: Course) => course.id === courseId)
    if (findCourse?.name) {
      form.setValue("courseId", courseId)
    }
  }

  return (
    <>
      <FieldContainer>
        <CheckBox label={t("create-course-duplicate")} {...register("createDuplicate")}></CheckBox>
      </FieldContainer>
      {createDuplicate && (
        <div>
          {isLoading ? (
            <Spinner variant="medium" />
          ) : error ? (
            <ErrorBanner error={error} variant="readOnly" />
          ) : (
            <>
              <FieldContainer>
                <SelectField
                  label={t("course-where-to-copy-the-content")}
                  id="duplicate-course-select-menu"
                  {...register("courseId")}
                  onChange={(e) => handleDuplicateMenu(e.target.value)}
                  options={
                    courses?.map((course) => {
                      return { label: course.name, value: course.id }
                    }) || []
                  }
                />
              </FieldContainer>
              <FieldContainer>
                <CheckBox
                  label={t("copied-course-is-a-language-version")}
                  {...register("createAsLanguageVersion")}
                ></CheckBox>
              </FieldContainer>
              {createAsLanguageVersion && (
                <div>
                  <LanguageVersionOptions form={form} courses={courses} />
                </div>
              )}
              {!createAsLanguageVersion && (
                <FieldContainer>
                  <CheckBox
                    label={t("grant-access-to-users-with-permissions-to-original-course")}
                    {...register("copy_user_permissions")}
                  ></CheckBox>
                </FieldContainer>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

export default DuplicateOptions
