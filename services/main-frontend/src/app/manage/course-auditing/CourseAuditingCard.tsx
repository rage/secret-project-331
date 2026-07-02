"use client"

import { css } from "@emotion/css"
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
import { Form, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import ContentArea from "./ContentArea"
import CourseAuditingField from "./CourseAuditingField"

import { updateCourseAfterAuditingMutation } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAudit, CourseToAuditUpdate } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { showErrorNotification } from "@/shared-module/common/components/Notifications/notificationHelpers"
import TimeComponent from "@/shared-module/common/components/TimeComponent"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { TextArea, TextField } from "@/shared-module/components"

interface CourseAuditingCardProps {
  id: string
  courseToAudit: CourseToAudit
  refetch(): Promise<QueryObserverResult<CourseToAudit[], unknown>>
}

enum UpdateStatus {
  "none",
  "saved",
  "failed",
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

  const onChange = (key: string) => (value: string) => {
    setCourse({
      ...course,
      [key]: value,
    })
  }

  const methods = useForm<CourseToAuditUpdate>({
    defaultValues: {
      ...course,
    },
  })

  const { control, register, handleSubmit, setValue, reset } = methods

  //TODO: add cansave and prepare for backend?
  const updateContent = async () => {
    await updateMutation.mutateAsync({
      path: {
        course_to_audit_id: course.id,
      },
      body: course,
    })
  }

  // TODO: update error notifications
  const updateMutation = useToastMutationOptions(
    updateCourseAfterAuditingMutation(),
    { method: "PUT", notify: true },
    {
      onSuccess: async (updated) => {
        if (updated.course_error) {
          showErrorNotification({
            header: t("could-not-connect-to-exercise-service-header"),
            message: t("could-not-connect-to-exercise-service-message", {
              message: updated.course_error,
            }),
          })
        }

        setCourse(updated.course)
        setStatus(UpdateStatus.saved)
        await refetch()
        window.setTimeout(() => {
          setStatus(UpdateStatus.none)
        }, 4000)
      },
      onError: () => {
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
            margin: 8px;
            padding: 1rem;
            border: 1px solid rgba(0, 0, 0, 0.12);
            /* Override card's overflow */
            overflow: visible !important;
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
                  onClick={updateContent}
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
                gap: 1.125rem;
              `}
            >
              <TextArea
                control={control}
                label={t("text-field-label-description")}
                autoResize={true}
                {...register("description")}
              />
              <TextField
                control={control}
                label={t("title-default-module-uh-course-code")}
                {...register("uh_course_code")}
              />
            </div>
          ) : (
            <div
              className={css`
                display: flex;
                flex-direction: column;
                gap: 1.125rem;
              `}
            >
              <div>
                <strong>{t("text-field-label-description")}:</strong>
                <br />
                <span> {course.description} </span>
              </div>
              <div>
                <strong>{t("title-default-module-uh-course-code")}:</strong>
                <br />
                <span> {course.uh_course_code} </span>
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
              label={`${t("label-created")} `}
              date={parseISO(courseToAudit.created_at)}
              right={false}
              boldLabel
            />
            <TimeComponent
              label={`${t("label-updated")} `}
              boldLabel
              date={parseISO(courseToAudit.updated_at)}
              right={true}
            />
          </div>
        </div>
      </div>
    </FormProvider>
  )
}

export default CourseAuditingCard
