"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import EditExamDialog from "../EditExamDialog"

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
import { baseTheme, headingFont, primaryFont, typography } from "@/shared-module/common/styles"
import {
  manageCourseByIdRoute,
  manageExamQuestionsRoute,
  testExamRoute,
} from "@/shared-module/common/utils/routes"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const detailRow = css`
  font-family: ${primaryFont};
  font-size: 0.9375rem;
  line-height: 1.5;
  color: ${baseTheme.colors.gray[600]};
  margin-bottom: 0.25rem;
`

const detailValue = css`
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
`

const ManageExam: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
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
        margin-bottom: 2rem;
      `}
    >
      {getExam.isError && <ErrorBanner variant={"readOnly"} error={getExam.error} />}
      {getExam.isLoading && <Spinner variant={"medium"} />}
      {getExam.isSuccess && (
        <>
          <h1
            className={css`
              font-family: ${headingFont};
              font-size: ${typography.h4};
              font-weight: 700;
              line-height: 1.2;
              color: ${baseTheme.colors.gray[700]};
              margin: 0 0 1rem 0;
            `}
          >
            {getExam.data.name}
          </h1>

          <div
            className={css`
              padding-bottom: 1rem;
              margin-bottom: 1rem;
              border-bottom: 1px solid ${baseTheme.colors.clear[300]};
            `}
          >
            <div className={detailRow}>
              {t("label-starts-at")}:{" "}
              <span className={detailValue}>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {humanReadableDateTime(getExam.data.starts_at, i18n.language) ?? "—"}
              </span>
            </div>
            <div className={detailRow}>
              {t("label-ends-at")}:{" "}
              <span className={detailValue}>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                {humanReadableDateTime(getExam.data.ends_at, i18n.language) ?? "—"}
              </span>
            </div>
            <div className={detailRow}>
              {t("label-duration")}:{" "}
              <span className={detailValue}>
                {getExam.data.time_minutes} {t("minutes")}
              </span>
            </div>
            <div className={detailRow}>
              {t("label-grade-exam-manually")}:{" "}
              <span className={detailValue}>
                {getExam.data.grade_manually ? t("yes") : t("no")}
              </span>
            </div>
            <div className={detailRow}>
              {t("label-minimum-points-threshold")}:{" "}
              <span className={detailValue}>
                {/* eslint-disable i18next/no-literal-string */}
                {getExam.data.minimum_points_treshold > 0
                  ? String(getExam.data.minimum_points_treshold)
                  : "—"}
                {/* eslint-enable i18next/no-literal-string */}
              </span>
            </div>
            <div className={detailRow}>
              {t("label-language")}: <span className={detailValue}>{getExam.data.language}</span>
            </div>
            <Button
              size="medium"
              variant="primary"
              disabled={!organizationId}
              onClick={() => {
                if (organizationId) {
                  setEditExamFormOpen(true)
                }
              }}
              className={css`
                margin-top: 0.75rem;
              `}
            >
              {t("edit-exam")}
            </Button>
          </div>

          {organizationId && (
            <EditExamDialog
              initialData={getExam.data}
              examId={getExam.data.id}
              organizationId={organizationId}
              open={editExamFormOpen}
              close={() => {
                setEditExamFormOpen(false)
                getExam.refetch()
              }}
            />
          )}

          <ul
            className={css`
              list-style-type: none;
              padding-left: 0;
              margin: 0 0 1.5rem 0;
              font-family: ${primaryFont};
              font-size: 1rem;
            `}
          >
            <li className={detailRow}>
              <a href={`/cms/pages/${getExam.data.page_id}`}>{t("link-edit-exam-page")}</a>
            </li>
            <li className={detailRow}>
              <Link
                href={`/manage/exams/${getExam.data.id}/permissions`}
                aria-label={`${t("link-manage-permissions")} ${getExam.data.name}`}
              >
                {t("link-manage-permissions")}
              </Link>
            </li>
            <li className={detailRow}>
              <a href={`/cms/exams/${getExam.data.id}/edit`}>{t("link-edit-exam-instructions")}</a>
            </li>
            <li className={detailRow}>
              <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-points`}>
                {t("link-export-points")}
              </a>
            </li>
            <li className={detailRow}>
              <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-submissions`}>
                {t("link-export-submissions")}
              </a>
            </li>
            <li className={detailRow}>
              <Link href={manageExamQuestionsRoute(getExam.data.id)}>{t("grading")}</Link>
            </li>
            {organizationSlug && (
              <li className={detailRow}>
                <Link href={testExamRoute(organizationSlug, getExam.data.id)}>
                  {t("link-test-exam")}
                </Link>
              </li>
            )}
          </ul>

          <h2
            className={css`
              font-family: ${headingFont};
              font-size: ${typography.h5};
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
              margin: 0 0 0.5rem 0;
            `}
          >
            {t("courses")}
          </h2>
          {getExam.data.courses.map((c) => (
            <div
              key={c.id}
              className={css`
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex-wrap: wrap;
                margin-bottom: 0.5rem;
              `}
            >
              <Link href={manageCourseByIdRoute(c.id)}>{c.name}</Link>
              <Button
                onClick={() => {
                  unsetCourseMutation.mutate({
                    examId: getExam.data.id,
                    courseId: c.id,
                  })
                }}
                variant="secondary"
                size="medium"
              >
                {t("button-text-remove")}
              </Button>
            </div>
          ))}
          <TextField
            label={t("add-course")}
            value={newCourse}
            onChange={(event) => setNewCourse(event.target.value)}
            placeholder={t("course-id")}
            className={css`
              margin-bottom: 0.5rem;
            `}
          />
          <Button
            onClick={() => {
              setCourseMutation.mutate({
                examId: getExam.data.id,
                courseId: newCourse,
              })
              setNewCourse("")
            }}
            variant="secondary"
            size="medium"
          >
            {t("add-course")}
          </Button>
          {setCourseMutation.isError && (
            <ErrorBanner variant="readOnly" error={setCourseMutation.error} />
          )}
          {unsetCourseMutation.isError && (
            <ErrorBanner variant="readOnly" error={unsetCourseMutation.error} />
          )}
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ManageExam))
