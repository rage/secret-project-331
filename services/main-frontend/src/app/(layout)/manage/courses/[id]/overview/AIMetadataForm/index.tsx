"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseAudiencesOptions,
  getCoursePrerequisitesOptions,
  getSisuCourseLlmDescriptionsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { updateMetadata } from "@/generated/api/sdk.generated"
import type { Course, CourseMetadataUpdate } from "@/generated/api/types.generated"
// import TextField from "@/shared-module/common/components/InputFields/TextField"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { QueryResults } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

import AIMetadataFormFields from "./AIMetadataFormFields"

interface EditCourseFormProps {
  course: Course
  onSubmitForm: () => void
  open: boolean
  onClose: () => void
}

const AIMetadataForm: React.FC<React.PropsWithChildren<EditCourseFormProps>> = ({
  course,
  onSubmitForm,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const courseId = course.id
  const sisuQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (value) =>
        getSisuCourseLlmDescriptionsOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )

  const prerequisitesQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (id) =>
        getCoursePrerequisitesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const audiencesQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: open,
      build: (id) =>
        getCourseAudiencesOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  const hasAudiences = audiencesQuery.data !== undefined && audiencesQuery.data?.length > 0

  const hasPrerequisites =
    prerequisitesQuery.data !== undefined && prerequisitesQuery.data?.length > 0

  const updateCourseMetadataMutation = useToastMutation(
    async (data: CourseMetadataUpdate) => {
      await updateMetadata({
        body: {
          ...data,
        },
        path: {
          course_id: course.id,
        },
      })
      onSubmitForm()
      onClose()
    },
    { method: "POST", notify: true },
  )

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      title={t("ai-metadata-form-title")}
      buttons={[
        {
          children: t("button-text-replace-metadata"),
          variant: "primary",
          // oxlint-disable-next-line i18next/no-literal-string
          form: "ai-metadata-form",
          disabled:
            sisuQuery.isFetching ||
            sisuQuery.isError ||
            prerequisitesQuery.isFetching ||
            prerequisitesQuery.isError ||
            audiencesQuery.isFetching ||
            audiencesQuery.isError,
        },
      ]}
    >
      <div>
        <QueryResults
          queries={[sisuQuery, prerequisitesQuery, audiencesQuery] as const}
          treatEmptyAsData
          renderData={([sisuData, prerequisitesData, audiencesData]) => {
            return (
              <AIMetadataFormFields
                course={course}
                sisuData={sisuData}
                prerequisites={prerequisitesData}
                audiences={audiencesData}
                hasPrerequisites={hasPrerequisites}
                hasAudiences={hasAudiences}
                onSubmit={(data) => updateCourseMetadataMutation.mutate(data)}
              />
            )
          }}
          renderBlockingError={({ error, retry: _retry }) => {
            return <ErrorBanner variant={"readOnly"} error={error} />
          }}
        />
      </div>
    </StandardDialog>
  )
}

export default AIMetadataForm
