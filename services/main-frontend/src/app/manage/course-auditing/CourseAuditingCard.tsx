"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
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

import {
  sectionHeaderRowStyles,
  uhCalloutStyles,
  uhCalloutTitleStyles,
  uhLineStyles,
  uhLinkStyles,
} from "./courseAuditingStyles"

import { updateCourseAfterAuditingMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAudit, CourseToAuditUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import {
  Checkbox,
  DateTimeLocalField,
  Link,
  nullIfEmpty,
  TextArea,
  TextField,
} from "@/shared-module/components"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import ClosedSectionFields from "./ClosedSectionFields"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"

interface CourseAuditingCardProps {
  id: string
  courseToAudit: CourseToAudit
  refetch: () => Promise<QueryObserverResult<CourseToAudit[], unknown>>
}

enum UpdateStatus {
  none,
  saved,
  failed,
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

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const methods = useForm<EditCourseToAudit>({
    defaultValues: {
      ...course,
      closed_at: course.closed_at
        ? (formatDateForDateTimeLocalInputs(course.closed_at) ?? null)
        : null,
      set_course_closed_at: Boolean(course.closed_at),
    },
  })

  const { control, handleSubmit } = methods

  const metaStyles = css`
    color: ${baseTheme.colors.gray[600]};
    font-size: 0.95rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
  `
  const onSubmit = handleSubmit((data) => {
    updateMutation.mutateAsync({
      body: {
        ...data,
        closed_at: data.closed_at ? parseISO(data.closed_at).toISOString() : null,
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
        window.setTimeout(() => {
          setStatus(UpdateStatus.none)
        }, 4000)
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
              <div className={metaStyles}>
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
                  onClick={toggleEdit}
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
              <div className={uhCalloutStyles}>
                <p className={uhCalloutTitleStyles}>{t("text-field-label-description")}</p>
                <p className={uhLineStyles}>{course.description}</p>
              </div>
              <div className={uhCalloutStyles}>
                <p className={uhCalloutTitleStyles}>{t("title-default-module-uh-course-code")}</p>
                <p className={uhLineStyles}>{course.uh_course_code}</p>
              </div>
              <div className={sectionHeaderRowStyles}>
                <div className={uhCalloutStyles}>
                  <p className={uhCalloutTitleStyles}>{t("closed-at")}</p>
                  {courseToAudit.closed_at && (
                    <TimeComponent date={parseISO(courseToAudit.closed_at)} />
                  )}
                </div>

                <div className={uhCalloutStyles}>
                  <p className={uhCalloutTitleStyles}>{t("closed-course-successor-id")}</p>
                  <p className={uhLineStyles}>{course.closed_course_successor_id}</p>
                </div>
              </div>
              <div className={uhCalloutStyles}>
                <p className={uhCalloutTitleStyles}>{t("closed-additional-message")}</p>
                <p className={uhLineStyles}>{course.closed_additional_message}</p>
              </div>
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
              boldLabel
              date={parseISO(courseToAudit.updated_at)}
              right={true}
            />
            {organizationSlug && (
              <Link
                className={uhLinkStyles}
                href={courseMaterialFrontPageHref(organizationSlug, course.slug)}
              >
                {t("course-auditing-card-open-course-front-page")}
              </Link>
            )}
            <Link className={uhLinkStyles} href={`courses/${courseToAudit.id}`}>
              {t("course-auditing-card-open-course-overview")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  )
}

export default CourseAuditingCard
