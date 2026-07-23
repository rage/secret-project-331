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
import { FormProvider, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { updateCourseAfterAuditingMutation } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseAuditingData,
  CourseAuditingDataUpdate,
  ModifiedModule,
} from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import { nullIfEmptyString } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Link, nullIfEmpty, TextArea } from "@/shared-module/components"

import ContentDisplayBox from "./ContentDisplayBox"
import ClosedSectionFields from "./EditClosedFields"
import EditModuleFields from "./EditModuleFields"
//import CourseDescription from "./CourseDescription"
import { contentRowStyles } from "./page"

interface CourseAuditingCardProps {
  id: string
  courseAuditingData: CourseAuditingData
  refetch: () => Promise<QueryObserverResult<CourseAuditingData[], unknown>>
}

enum UpdateStatus {
  none = 0,
  saved = 1,
  failed = 2,
}

export interface EditModuleData extends ModifiedModule {
  override_completion_link: boolean
}

export interface EditCourseAuditingData extends CourseAuditingDataUpdate {
  set_course_closed_at: boolean
  modules: EditModuleData[]
}

const CourseAuditingCard: React.FC<CourseAuditingCardProps> = ({
  id,
  courseAuditingData,
  refetch,
}) => {
  const { t } = useTranslation()

  const [editing, setEditing] = useState<boolean>(false)
  const [course, setCourse] = useState<CourseAuditingData>(courseAuditingData)
  const [status, setStatus] = useState<UpdateStatus>(UpdateStatus.none)

  const methods = useForm<EditCourseAuditingData>({
    defaultValues: {
      ...courseAuditingData,
      closed_at: course.closed_at
        ? (formatDateForDateTimeLocalInputs(course.closed_at) ?? null)
        : null,
      set_course_closed_at: Boolean(course.closed_at),
    },
  })

  const { control, handleSubmit, reset, watch } = methods

  //const formValues = watch()

  // oxlint-disable-next-line i18next/no-literal-string
  const { fields } = useFieldArray({ control, name: "modules" })

  console.log(fields)
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
        // uh_course_code: nullIfEmptyString(data.uh_course_code),
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
      onSuccess: (updated) => {
        setCourse(updated)
        refetch()
        setStatus(UpdateStatus.saved)
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

  const linkStyles = css`
    color: ${baseTheme.colors.green[700]};
    text-decoration: underline;
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
              line-height: 2rem;
              padding-bottom: 1.5rem;
              align-items: baseline;
            `}
          >
            <div>
              <h1
                className={css`
                  font-weight: 400;
                  font-size: 1.5rem;
                `}
              >
                {course.name}
              </h1>
              <div
                className={css`
                  color: ${baseTheme.colors.gray[600]};
                  font-size: 1rem;
                  display: flex;
                  flex-wrap: wrap;
                  margin-top: 0.5rem;
                `}
              >
                {course.organization_name}
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

              <ClosedSectionFields />

              {fields.map((module, idx) => (
                <EditModuleFields key={module.id} module={module} idx={idx} />
              ))}
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

              {course.closed_at ? (
                <div
                  className={css`
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                  `}
                >
                  <div className={contentRowStyles}>
                    <ContentDisplayBox
                      label={t("closed-at")}
                      content={<TimeComponent date={parseISO(course.closed_at)} />}
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
                <ContentDisplayBox label={t("closed-at")} />
              )}

              {course.modules.map((module) => (
                <div
                  key={module.id}
                  className={css`
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                  `}
                >
                  <div
                    className={css`
                      font-size: 1.15rem;
                      font-weight: 600;
                      color: ${baseTheme.colors.gray[900]};
                      margin: 0.5rem 0rem;
                    `}
                  >
                    {module.name ? `${module.order_number}. ${module.name}` : t("default-module")}
                  </div>
                  <ContentDisplayBox
                    label={t("completion-registration-link")}
                    content={module.completion_registration_link_override}
                  />
                  <div className={contentRowStyles}>
                    <ContentDisplayBox
                      label={t("uh-course-code")}
                      content={module.uh_course_code}
                    />
                    <ContentDisplayBox label={t("ects-credits")} content={module.ects_credits} />
                  </div>
                </div>
              ))}
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
              date={parseISO(course.created_at)}
              right={false}
              boldLabel
            />
            <TimeComponent
              label={t("label-updated")}
              date={parseISO(course.updated_at)}
              right={true}
              boldLabel
            />
            <Link
              className={linkStyles}
              href={courseMaterialFrontPageHref(course.organization_slug, course.slug)}
            >
              {t("course-auditing-card-open-course-front-page")}
            </Link>
            <Link className={linkStyles} href={manageCourseByIdRoute(courseAuditingData.id)}>
              {t("course-auditing-card-open-course-overview")}
            </Link>
          </div>
        </div>
      </div>
    </FormProvider>
  )
}

export default CourseAuditingCard
