"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import EditExamDialog from "../EditExamDialog"

import {
  getExamOptions,
  getOrganizationExamByExamIdOptions,
  setExamCourseMutation,
  unsetExamCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import { getOrganization } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, headingFont, primaryFont, typography } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import {
  manageCourseByIdRoute,
  manageExamQuestionsRoute,
  testExamRoute,
} from "@/shared-module/common/utils/routes"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const GET_ORGANIZATION_QUERY_KEY = "getOrganization"

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
  const getExam = useQuery({
    ...getExamOptions({
      path: {
        id,
      },
    }),
  })
  const organizationExam = useQuery({
    ...getOrganizationExamByExamIdOptions({
      path: {
        exam_id: id,
      },
    }),
  })
  const organizationId = organizationExam.data?.organization_id

  const organizationSlug = useQuery({
    queryKey: [GET_ORGANIZATION_QUERY_KEY, organizationId] as const,
    queryFn: organizationId
      ? () =>
          getOrganization({
            path: {
              organization_id: assertNotNullOrUndefined(organizationId),
            },
          })
      : skipToken,
    enabled: organizationId != null,
  }).data?.slug

  const [editExamFormOpen, setEditExamFormOpen] = useState(false)
  const [newCourse, setNewCourse] = useState("")
  const setCourseMutation = useToastMutationOptions(
    setExamCourseMutation(),
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

  const unsetCourseMutation = useToastMutationOptions(
    unsetExamCourseMutation(),
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
              <a href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-points`} download>
                <Button variant="tertiary" size="medium" type="button">
                  {t("link-export-points")}
                </Button>
              </a>
            </li>
            <li className={detailRow}>
              <a
                href={`/api/v0/main-frontend/exams/${getExam.data.id}/export-submissions`}
                download
              >
                <Button variant="tertiary" size="medium" type="button">
                  {t("link-export-submissions")}
                </Button>
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
                    path: {
                      id: getExam.data.id,
                    },
                    body: {
                      course_id: c.id,
                    },
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
                path: {
                  id: getExam.data.id,
                },
                body: {
                  course_id: newCourse,
                },
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
