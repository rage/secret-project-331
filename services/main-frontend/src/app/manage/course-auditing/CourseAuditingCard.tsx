"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { QueryObserverResult } from "@tanstack/react-query"
import {
  BellXmark,
  CheckCircle,
  FloppyDiskSave,
  Pencil,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { uhLinkStyles } from "./analysisFormDomain"

import { updateCourseAfterAuditingMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAudit, CourseToAuditUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { Link, TextArea, TextField } from "@/shared-module/components"

interface CourseAuditingCardProps {
  id: string
  courseToAudit: CourseToAudit
  refetch(): Promise<QueryObserverResult<CourseToAudit[], unknown>>
}

enum UpdateStatus {
  none,
  saved,
  failed,
}

const CourseAuditingCard: React.FC<React.PropsWithChildren<CourseAuditingCardProps>> = ({
  id,
  courseToAudit,
  refetch,
}) => {
  const { t } = useTranslation()

  const [editing, setEditing] = useState<boolean>(false)
  const [course, setCourse] = useState<CourseToAudit>(courseToAudit)
  const [status, setStatus] = useState<UpdateStatus>(UpdateStatus.none)

  const toggleEdit = () => {
    setEditing(!editing)
  }

  const methods = useForm<CourseToAuditUpdate>({
    defaultValues: {
      ...course,
    },
  })

  const { control, handleSubmit } = methods

  const onSubmit = handleSubmit((data) => {
    updateMutation.mutateAsync({
      body: { ...data },
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

  const fieldTitleStyle = css`
    font-size: 0.85rem;
    font-weight: 600;
    color: ${baseTheme.colors.gray[700]};
    margin: 0.25rem 0 0 0;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid ${baseTheme.colors.gray[200]};
  `

  const FieldSet = styled.fieldset`
    margin-bottom: 1rem;
    border: 1px solid ${baseTheme.colors.gray[200]};
    border-radius: 4px;
    padding: 0.5rem 1rem;
  `

  const Legend = styled.legend`
    font-weight: 600;
    padding: 0 0.25rem;
  `

  const HelpText = styled.p`
    margin: 0.25rem 0 0.5rem;
    font-size: 0.9rem;
    color: ${baseTheme.colors.gray[500]};
  `
  return (
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
                {status == UpdateStatus.none ? (
                  <FloppyDiskSave size={20} />
                ) : status == UpdateStatus.saved ? (
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
              autoResize={true}
              name={"description"}
            />
            <TextField
              control={control}
              label={t("title-default-module-uh-course-code")}
              name={"uh_course_code"}
            />
          </div>
        ) : (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <div>
              <strong>{t("text-field-label-description") + ":"}</strong>
              <br />
              <span>{course.description}</span>
            </div>
            <div>
              <p className={fieldTitleStyle}>{t("text-field-label-description")}:</p>
              <br />
              <span> {course.description} </span>
            </div>
            <FieldSet>
              <Legend>{t("text-field-label-description")}</Legend>
              <span> {course.description} </span>
            </FieldSet>
            <FieldSet>
              <Legend>{t("title-default-module-uh-course-code")}</Legend>
              <span> {course.uh_course_code} </span>
            </FieldSet>
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
          {courseToAudit.closed_at && (
            <TimeComponent
              label={t("course-auditing-closed-at")}
              boldLabel
              date={parseISO(courseToAudit.closed_at)}
              right={true}
            />
          )}

          <Link className={uhLinkStyles} href={`courses/${courseToAudit.id}`}>
            {t("course-overview")}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CourseAuditingCard
