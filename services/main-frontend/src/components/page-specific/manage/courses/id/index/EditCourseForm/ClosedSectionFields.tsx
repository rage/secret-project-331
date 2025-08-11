import styled from "@emotion/styled"
import React from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { EditCourseFormValues } from "."

import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import DateTimeLocal from "@/shared-module/common/components/InputFields/DateTimeLocal"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { validateUUID } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"

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
  } = useFormContext<EditCourseFormValues>()

  // eslint-disable-next-line i18next/no-literal-string
  const isClosed = useWatch({ name: "set_course_closed_at", control })

  return (
    <>
      <FieldContainer>
        <CheckBox
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
          <FieldContainer>
            <DateTimeLocal label={t("closed-at")} {...register("closed_at")} />
          </FieldContainer>
          <FieldContainer>
            <TextAreaField
              label={t("closed-additional-message")}
              {...register("closed_additional_message")}
            />
          </FieldContainer>
          <FieldContainer>
            <TextField
              label={t("closed-course-successor-id")}
              error={errors.closed_course_successor_id?.message}
              {...register("closed_course_successor_id", {
                validate: (value) => {
                  if (!value) {
                    return true
                  }
                  return validateUUID(value) || t("invalid-uuid-format")
                },
              })}
            />
          </FieldContainer>
        </>
      )}
    </>
  )
}

export default ClosedSectionFields
