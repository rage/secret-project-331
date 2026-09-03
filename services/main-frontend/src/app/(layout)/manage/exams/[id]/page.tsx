"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import NextLink from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getExamOptions,
  getOrganizationExamByExamIdOptions,
  setExamCourseMutation,
  unsetExamCourseMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import { getOrganization } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
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
import { Button, Link, QueryResult, TextField } from "@/shared-module/components"

import EditExamDialog from "../EditExamDialog"

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
    enabled: organizationId !== undefined,
  }).data?.slug

  const [editExamFormOpen, setEditExamFormOpen] = useState(false)
  const {
    control: newCourseControl,
    watch: watchNewCourse,
    reset: resetNewCourse,
  } = useForm<{
    newCourse: string
  }>({
    defaultValues: { newCourse: "" },
  })
  // oxlint-disable-next-line i18next/no-literal-string
  const newCourse = watchNewCourse("newCourse")
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
      <QueryResult query={getExam}>
        {(data) => (
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
              {data.name}
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
                  {/* oxlint-disable-next-line i18next/no-literal-string */}
                  {humanReadableDateTime(data.starts_at, i18n.language) ?? "—"}
                </span>
              </div>
              <div className={detailRow}>
                {t("label-ends-at")}:{" "}
                <span className={detailValue}>
                  {/* oxlint-disable-next-line i18next/no-literal-string */}
                  {humanReadableDateTime(data.ends_at, i18n.language) ?? "—"}
                </span>
              </div>
              <div className={detailRow}>
                {t("label-duration")}:{" "}
                <span className={detailValue}>
                  {data.time_minutes} {t("minutes")}
                </span>
              </div>
              <div className={detailRow}>
                {t("label-grade-exam-manually")}:{" "}
                <span className={detailValue}>{data.grade_manually ? t("yes") : t("no")}</span>
              </div>
              <div className={detailRow}>
                {t("label-minimum-points-threshold")}:{" "}
                <span className={detailValue}>
                  {/* oxlint-disable i18next/no-literal-string */}
                  {data.minimum_points_treshold > 0 ? String(data.minimum_points_treshold) : "—"}
                  {/* oxlint-enable i18next/no-literal-string */}
                </span>
              </div>
              <div className={detailRow}>
                {t("label-language")}: <span className={detailValue}>{data.language}</span>
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
                initialData={data}
                examId={data.id}
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
                <a href={`/cms/pages/${data.page_id}`}>{t("link-edit-exam-page")}</a>
              </li>
              <li className={detailRow}>
                <NextLink
                  href={`/manage/exams/${data.id}/permissions`}
                  aria-label={`${t("link-manage-permissions")} ${data.name}`}
                >
                  {t("link-manage-permissions")}
                </NextLink>
              </li>
              <li className={detailRow}>
                <a href={`/cms/exams/${data.id}/edit`}>{t("link-edit-exam-instructions")}</a>
              </li>
              <li className={detailRow}>
                <Link
                  href={`/api/v0/main-frontend/exams/${data.id}/export-points`}
                  download
                  styledAsButton
                  variant="tertiary"
                  size="medium"
                >
                  {t("link-export-points")}
                </Link>
              </li>
              <li className={detailRow}>
                <Link
                  href={`/api/v0/main-frontend/exams/${data.id}/export-submissions`}
                  download
                  styledAsButton
                  variant="tertiary"
                  size="medium"
                >
                  {t("link-export-submissions")}
                </Link>
              </li>
              <li className={detailRow}>
                <NextLink href={manageExamQuestionsRoute(data.id)}>{t("grading")}</NextLink>
              </li>
              {organizationSlug && (
                <li className={detailRow}>
                  <NextLink href={testExamRoute(organizationSlug, data.id)}>
                    {t("link-test-exam")}
                  </NextLink>
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
            {data.courses.map((c) => (
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
                <NextLink href={manageCourseByIdRoute(c.id)}>{c.name}</NextLink>
                <Button
                  onClick={() => {
                    unsetCourseMutation.mutate({
                      path: {
                        id: data.id,
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
              name="newCourse"
              control={newCourseControl}
              label={t("add-course")}
              className={css`
                margin-bottom: 0.5rem;
              `}
            />
            <Button
              onClick={() => {
                setCourseMutation.mutate({
                  path: {
                    id: data.id,
                  },
                  body: {
                    course_id: newCourse,
                  },
                })
                resetNewCourse()
              }}
              variant="secondary"
              size="medium"
            >
              {t("add-course")}
            </Button>
            {/* notify:true already announces these errors via the toast; the banners are just the persistent copy */}
            {setCourseMutation.isError && (
              // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
              <ErrorBanner variant="readOnly" error={setCourseMutation.error} announce="off" />
            )}
            {unsetCourseMutation.isError && (
              // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
              <ErrorBanner variant="readOnly" error={unsetCourseMutation.error} announce="off" />
            )}
          </>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ManageExam))
