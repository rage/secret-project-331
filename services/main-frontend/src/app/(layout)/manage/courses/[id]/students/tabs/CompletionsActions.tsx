"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CreditRegistrationExportLink from "@/components/credit-registration/CreditRegistrationExportLink"
import { cardCss, noteCss, rowCss, sectionCss } from "@/components/credit-registration/styles"
import { useCanViewCreditRegistrations } from "@/components/credit-registration/teacherCreditRegistrations"
import AddCompletionsForm from "@/components/forms/AddCompletionsForm"
import {
  createCourseInstanceCompletions,
  getCourseStudentsCompletions,
  previewCourseInstanceCompletions,
} from "@/generated/api/sdk.generated"
import type {
  ManualCompletionPreview,
  ManualCompletionPreviewUser,
  TeacherManualCompletionRequest,
} from "@/generated/api/types.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Button, Link } from "@/shared-module/components"

import CompletionRegistrationPreview from "../../../../course-instances/[id]/CompletionRegistrationPreview"
import { invalidateCourseStudents } from "../studentsQueries"

/**
 * The grade each of these students already holds for the module, so the preview can say what a
 * manual completion would replace. The preview endpoint does not carry it.
 */
const withPreviousBestGrades = async (
  courseId: string,
  courseModuleId: string,
  users: ManualCompletionPreviewUser[],
): Promise<ManualCompletionPreviewUser[]> => {
  if (users.length === 0) {
    return users
  }
  const rows = await getCourseStudentsCompletions({
    path: { course_id: courseId },
    body: { user_ids: users.map((user) => user.user_id) },
  })
  const best = new Map<string, number>()
  for (const row of rows) {
    if (row.module_id !== courseModuleId || typeof row.grade !== "number") {
      continue
    }
    best.set(row.user_id, Math.max(best.get(row.user_id) ?? row.grade, row.grade))
  }
  return users.map((user) => ({ ...user, previous_best_grade: best.get(user.user_id) ?? null }))
}

interface Props {
  courseId: string
  /** Manual completions and the grade export are both per instance, so both wait for one. */
  courseInstanceId: string | null
}

/**
 * The exports of this roster and the one way to add a completion by hand.
 *
 * Both exports live here rather than one per section, so a teacher looking for "the download" has
 * one place to look and each file says what is in it.
 */
const CompletionsActions: React.FC<Props> = ({ courseId, courseInstanceId }) => {
  const { t } = useTranslation()
  const canExportRegistrations = useCanViewCreditRegistrations(courseId)
  const courseStructureQuery = useCourseStructure(courseId)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [request, setRequest] = useState<TeacherManualCompletionRequest | null>(null)
  const [preview, setPreview] = useState<ManualCompletionPreview | null>(null)

  const addCompletions = useToastMutation(
    (data: TeacherManualCompletionRequest) =>
      createCourseInstanceCompletions({
        body: data,
        path: { course_instance_id: courseInstanceId ?? "" },
      }),
    { notify: true, method: "POST", successMessage: t("completions-submitted-successfully") },
    {
      onSuccess: async () => {
        setRequest(null)
        setPreview(null)
        setIsFormOpen(false)
        await invalidateCourseStudents(courseId)
      },
    },
  )

  const runPreview = async (data: TeacherManualCompletionRequest): Promise<void> => {
    setRequest(data)
    const result = await previewCourseInstanceCompletions({
      body: data,
      path: { course_instance_id: courseInstanceId ?? "" },
    })
    setPreview({
      ...result,
      already_completed_users: await withPreviousBestGrades(
        courseId,
        data.course_module_id,
        result.already_completed_users,
      ),
    })
  }

  return (
    <div className={sectionCss}>
      <div className={rowCss}>
        {courseInstanceId && (
          <Link
            href={`/api/v0/main-frontend/course-instances/${courseInstanceId}/export-completions`}
            styledAsButton
            variant="secondary"
            size="medium"
            download
          >
            {t("link-export-grades")}
          </Link>
        )}
        {canExportRegistrations && <CreditRegistrationExportLink courseId={courseId} />}
        {courseInstanceId && (
          <Button
            variant="secondary"
            size="medium"
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
          >
            {t("manually-add-completions")}
          </Button>
        )}
      </div>
      <p className={noteCss}>
        {courseInstanceId
          ? t("completions-export-contents")
          : t("completions-export-needs-an-instance")}
      </p>
      {isFormOpen && courseInstanceId && (
        <div className={cardCss}>
          <AddCompletionsForm
            onSubmit={runPreview}
            courseModules={courseStructureQuery.data?.modules ?? []}
            submitText={t("button-text-check")}
          />
          {preview && request && (
            <CompletionRegistrationPreview
              manualCompletionPreview={preview}
              onSubmit={(options) => {
                addCompletions.mutate({
                  ...request,
                  skip_duplicate_completions: options.skipDuplicateCompletions,
                })
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default CompletionsActions
