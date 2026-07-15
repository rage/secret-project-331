"use client"

import { css } from "@emotion/css"
import type { QueryObserverResult } from "@tanstack/react-query"
import {
  BellXmark,
  CheckCircle,
  FloppyDiskSave,
  Pencil,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourseAfterAuditingMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAudit, CourseToAuditUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { Link, nullIfEmpty, TextArea, TextField } from "@/shared-module/components"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import ClosedSectionFields from "./ClosedSectionFields"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import ContentDisplayBox from "./ContentDisplayBox"
import { contentRowStyles } from "./page"

interface CourseAuditingCardProps {
  id: string
  courseToAudit: CourseToAudit
  refetch: () => Promise<QueryObserverResult<CourseToAudit[], unknown>>
}

enum UpdateStatus {
  none = 0,
  saved = 1,
  failed = 2,
}

export type EditCourseToAudit = CourseToAuditUpdate & { set_course_closed_at: boolean }

const CourseAuditingCard: React.FC<React.PropsWithChildren<CourseAuditingCardProps>> = ({
  id,
  courseToAudit,
  refetch,
}) => {
  const { t } = useTranslation()

  const [editing, setEditing] = useState<boolean>(false)
  const [course, setCourse] = useState<CourseToAudit>(courseToAudit)
  const [status, setStatus] = useState<UpdateStatus>(UpdateStatus.none)
  const courseBreadcrumbInfoQuery = useCourseBreadcrumbInfoQuery(course.id)
  const organizationSlug = courseBreadcrumbInfoQuery.data?.organization_slug

  const methods = useForm<EditCourseToAudit>({
    defaultValues: {
      ...course,
      closed_at: course.closed_at
        ? (formatDateForDateTimeLocalInputs(course.closed_at) ?? null)
        : null,
      set_course_closed_at: Boolean(course.closed_at),
    },
  })

  const { control, handleSubmit, reset } = methods

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const cancelEdit = () => {
    reset()
    setEditing(!editing)
  }

  const onSubmit = handleSubmit((data) => {
    updateMutation.mutateAsync({
      body: {
        ...data,
        uh_course_code: nullIfEmptyString(data.uh_course_code),
        closed_at: data.set_course_closed_at
          ? data.closed_at
            ? parseISO(data.closed_at).toISOString()
            : null
          : null,
        closed_additional_message: nullIfEmptyString(data.closed_additional_message),
        closed_course_successor_id: nullIfEmptyString(data.closed_course_successor_id),
      },
      path: {
        course_to_audit_id: course.id,
      },
    })
  })

  const updateMutation = useToastMutationOptions(
    updateCourseAfterAuditingMutation(),
    { method: "PUT", notify: true },
    {
      onSuccess: async (updated) => {
        setCourse(updated)
        setStatus(UpdateStatus.saved)
        await refetch()
        setEditing(false)
        setStatus(UpdateStatus.none)
      },
      onError: () => {
        showErrorNotification({
          message: t("course-auditing-update-error"),
        })
        setStatus(UpdateStatus.failed)
        window.setTimeout(() => {
          setStatus(UpdateStatus.none)
        }, 4000)
      },
    },
  )

  const uhLinkStyles = css`
    color: ${baseTheme.colors.green[700]};
    text-decoration: underline;
    word-break: break-all;
  `

  return (
    <FormProvider {...methods}>
      <div>
        <div
          key={id}
          className={css`
            padding: 1rem;
            border: 1px solid rgba(0, 0, 0, 0.12);
            background: ${baseTheme.colors.gray[50]};
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: row;
              justify-content: space-between;
              line-height: 1.5;
              padding-bottom: 1.5rem;
              align-items: baseline;
            `}
          >
            <div>
              <h1
                className={css`
                  margin: 0;
                  font-weight: 400;
                  font-size: 1.5rem;
                `}
              >
                {course.name}
              </h1>
              <div
                className={css`
                  color: ${baseTheme.colors.gray[600]};
                  font-size: 0.95rem;
                  display: flex;
                  flex-wrap: wrap;
                  gap: 1rem;
                  margin-top: 0.5rem;
                `}
              >
                <span>{courseBreadcrumbInfoQuery.data?.organization_name}</span>
              </div>
            </div>

            {editing ? (
              <div
                className={css`
                  display: flex;
                  flex-direction: row;
                `}
              >
                <Button
                  aria-label={t("button-text-save")}
                  onClick={onSubmit}
                  variant={"icon"}
                  size={"small"}
                >
                  {status === UpdateStatus.none ? (
                    <FloppyDiskSave size={20} />
                  ) : status === UpdateStatus.saved ? (
                    <CheckCircle size={20} />
                  ) : (
                    <BellXmark size={20} />
                  )}
                </Button>
                <Button
                  aria-label={t("button-text-cancel")}
                  onClick={cancelEdit}
                  variant={"icon"}
                  size={"small"}
                >
                  <XmarkCircle size={20} />
                </Button>
              </div>
            ) : (
              <div
                className={css`
                  display: flex;
                  flex-direction: row;
                `}
              >
                <Button aria-label={t("edit")} onClick={toggleEdit} variant={"icon"} size={"small"}>
                  <Pencil size={20} />
                </Button>
              </div>
            )}
          </div>

          {editing ? (
            <div
              className={css`
                display: flex;
                flex-direction: column;
                gap: 1rem;
              `}
            >
              <TextArea
                control={control}
                label={t("text-field-label-description")}
                name={"description"}
                rules={nullIfEmpty}
                autoResize={true}
              />
              {/* <CourseDescription course={course} refetch={refetch} /> */}
              <TextField
                control={control}
                label={t("title-default-module-uh-course-code")}
                name={"uh_course_code"}
                rules={nullIfEmpty}
              />
              <ClosedSectionFields />
            </div>
          ) : (
            <div
              className={css`
                display: flex;
                flex-direction: column;
                gap: 1rem;
              `}
            >
              <ContentDisplayBox
                label={t("text-field-label-description")}
                content={course.description}
              />
              {courseToAudit.closed_at ? (
                <div>
                  <div className={contentRowStyles}>
                    <ContentDisplayBox
                      label={t("title-default-module-uh-course-code")}
                      content={course.uh_course_code}
                    />
                    <ContentDisplayBox
                      label={t("closed-at")}
                      content={<TimeComponent date={parseISO(courseToAudit.closed_at)} />}
                    />
                    <ContentDisplayBox
                      label={t("closed-course-successor-id")}
                      content={course.closed_course_successor_id}
                    />
                  </div>
                  <ContentDisplayBox
                    label={t("closed-additional-message")}
                    content={course.closed_additional_message}
                  />
                </div>
              ) : (
                <div className={contentRowStyles}>
                  <ContentDisplayBox
                    label={t("title-default-module-uh-course-code")}
                    content={course.uh_course_code}
                  />
                  <ContentDisplayBox label={t("closed-at")} />
                </div>
              )}
            </div>
          )}
          <div
            className={css`
              display: flex;
              justify-content: space-between;
              padding-top: 1rem;
            `}
          >
            <TimeComponent
              label={t("label-created")}
              date={parseISO(courseToAudit.created_at)}
              right={false}
              boldLabel
            />
            <TimeComponent
              label={t("label-updated")}
              date={parseISO(courseToAudit.updated_at)}
              right={true}
              boldLabel
            />
            {organizationSlug && (
              <Link
                className={uhLinkStyles}
                href={courseMaterialFrontPageHref(organizationSlug, course.slug)}
              >
                {t("course-auditing-card-open-course-front-page")}
              </Link>
            )}
            <Link className={uhLinkStyles} href={manageCourseByIdRoute(courseToAudit.id)}>
              {t("course-auditing-card-open-course-overview")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  )
}

export default CourseAuditingCard
