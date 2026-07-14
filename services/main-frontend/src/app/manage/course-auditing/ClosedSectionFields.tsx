"use client"

import styled from "@emotion/styled"
import React from "react"
import { useWatch, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { validateUUID } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import type { EditCourseToAudit } from "./CourseAuditingCard"
import {
  Checkbox,
  DateTimeLocalField,
  nullIfEmpty,
  TextArea,
  TextField,
} from "@/shared-module/components"
import { sectionHeaderRowStyles } from "./courseAuditingStyles"

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const ClosedSectionFields = (): React.ReactElement => {
  const { t } = useTranslation()
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
    control,
  } = useFormContext<EditCourseToAudit>()

  // oxlint-disable-next-line i18next/no-literal-string
  const isClosed = useWatch({ name: "set_course_closed_at", control })

  return (
    <>
      <FieldContainer>
        <Checkbox
          control={control}
          label={t("set-course-closed-at")}
          {...register("set_course_closed_at", {
            // We purposefully do NOT clear related values when unchecked.
            // Instead, we nullify `closed_at` at submit time (see submit mapping),
            // so users can re-check and keep their previous inputs.
            onChange: (e) => {
              const checked = (e.target as HTMLInputElement).checked
              if (checked) {
                const currentClosedAt = getValues("closed_at")
                if (!currentClosedAt) {
                  setValue("closed_at", formatDateForDateTimeLocalInputs(new Date()) ?? null)
                }
              }
            },
          })}
        />
      </FieldContainer>
      {isClosed && (
        <>
          <div className={sectionHeaderRowStyles}>
            <DateTimeLocalField
              control={control}
              label={t("closed-at")}
              name={"closed_at"}
              rules={nullIfEmpty}
              hourCycle={24}
              // oxlint-disable-next-line i18next/no-literal-string
              fieldSize={"md"}
            />
            <TextField
              control={control}
              label={t("closed-course-successor-id")}
              name={"closed_course_successor_id"}
              errorMessage={errors.closed_course_successor_id?.message}
              rules={{
                ...nullIfEmpty,
                validate: (value) => {
                  if (!value) {
                    return true
                  }
                  return validateUUID(value) || t("invalid-uuid-format")
                },
              }}
            />
          </div>
          <TextArea
            control={control}
            label={t("closed-additional-message")}
            name={"closed_additional_message"}
            autoResize={true}
            rules={nullIfEmpty}
          />
        </>
      )}
    </>
  )
}

export default ClosedSectionFields
