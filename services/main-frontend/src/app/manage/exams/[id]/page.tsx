"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import EditExamDialog from "@/components/page-specific/manage/courses/id/exams/EditExamDialog"
import {
  fetchExam,
  fetchOrganization,
  fetchOrgExam,
  setCourse,
  unsetCourse,
} from "@/services/backend/exams"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import {
  manageCourseByIdRoute,
  manageExamQuestionsRoute,
  testExamRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Organization: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const getExam = useQuery({ queryKey: [`exam-${id}`], queryFn: () => fetchExam(id) })
  const organizationId = useQuery({
    queryKey: [`organizations-${id}`],
    queryFn: () => fetchOrgExam(id),
  }).data?.organization_id

  const organizationSlug = useQuery({
    queryKey: [`organizations-${organizationId}`],
    queryFn: () => fetchOrganization(organizationId ?? ""),
    enabled: !!organizationId,
  }).data?.slug

  const [editExamFormOpen, setEditExamFormOpen] = useState(false)
  const [newCourse, setNewCourse] = useState("")
  const setCourseMutation = useToastMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      return setCourse(examId, courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        getExam.refetch()
      },
    },
  )

  const unsetCourseMutation = useToastMutation(
    ({ examId, courseId }: { examId: string; courseId: string }) => {
      return unsetCourse(examId, courseId)
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        getExam.refetch()
      },
    },
  )
  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      {getExam.isError && <ErrorBanner variant={"readOnly"} error={getExam.error} />}
      {getExam.isLoading && <Spinner variant={"medium"} />}
      {getExam.isSuccess && (
        <>
          <h1>
            {getExam.data.name} {getExam.data.id}
          </h1>
          <ul
            className={css`
              list-style-type: none;
              padding-left: 0;
            `}
          >
            <li>
              <a href={`/cms/pages/${getExam.data.page_id}`}>{t("manage-page")}</a> (
              {getExam.data.page_id})
            </li>
            <li>
              <Link
                href={`/manage/exams/${getExam.data.id}/permissions`}
                aria-label={`${t("link-manage-permissions")} ${getExam.data.name}`}
              >
                {t("link-manage-permissions")}
              </Link>
            </li>
            <li>
              <a href={`/cms/exams/${getExam.data.id}/edit`}>{t("link-edit-exam-instructions")}</a>
            </li>
            <li>
              <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-points`}>
                {t("link-export-points")}
              </a>
            </li>
            <li>
              <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-submissions`}>
                {t("link-export-submissions")}
              </a>
            </li>
            <li>
              <Link href={manageExamQuestionsRoute(getExam.data.id)}>{t("grading")}</Link>
            </li>
            <li>
              {organizationSlug && (
                <Link href={testExamRoute(organizationSlug, getExam.data.id)}>
                  {t("link-test-exam")}
                </Link>
              )}
            </li>
            <li>
              <div
                className={css`
                  margin-bottom: 1rem;
                `}
              >
                <EditExamDialog
                  initialData={getExam.data || null}
                  examId={getExam.data.id}
                  organizationId={organizationId || ""}
                  open={editExamFormOpen}
                  close={() => {
                    setEditExamFormOpen(!setEditExamFormOpen)
                    getExam.refetch()
                  }}
                />
              </div>
              <Button
                size="medium"
                variant="primary"
                onClick={() => setEditExamFormOpen(!editExamFormOpen)}
              >
                {t("edit-exam")}
              </Button>
            </li>
          </ul>
          <h2>{t("courses")}</h2>
          {getExam.data.courses.map((c) => (
            <div key={c.id}>
              <Link href={manageCourseByIdRoute(c.id)}>{c.name}</Link> ({c.id}){" "}
              <Button
                onClick={() => {
                  unsetCourseMutation.mutate({ examId: getExam.data.id, courseId: c.id })
                }}
                variant={"secondary"}
                size={"medium"}
              >
                {t("button-text-remove")}
              </Button>
            </div>
          ))}
          <TextField
            label={t("add-course")}
            onChange={(event) => {
              setNewCourse(event.target.value)
            }}
            placeholder={t("course-id")}
            className={css`
              margin-bottom: 1rem;
            `}
          ></TextField>

          <Button
            onClick={() => {
              setCourseMutation.mutate({ examId: getExam.data.id, courseId: newCourse })
              setNewCourse("")
            }}
            variant={"secondary"}
            size={"medium"}
          >
            {t("add-course")}
          </Button>
          {setCourseMutation.isError && (
            <ErrorBanner variant={"readOnly"} error={setCourseMutation.error} />
          )}
          {unsetCourseMutation.isError && (
            <ErrorBanner variant={"readOnly"} error={unsetCourseMutation.error} />
          )}
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(Organization))
