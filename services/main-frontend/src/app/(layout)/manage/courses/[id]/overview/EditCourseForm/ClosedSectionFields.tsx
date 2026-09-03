"use client"

import styled from "@emotion/styled"
import React, { useEffect } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { validateUUID } from "@/shared-module/common/utils/strings"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import {
  Checkbox,
  DateTimeLocalField,
  nullIfEmpty,
  TextArea,
  TextField,
} from "@/shared-module/components"

import type { EditCourseFormValues } from "."

const FieldContainer = styled.div`
  margin-bottom: 1rem;
`

const ClosedSectionFields = (): React.ReactElement => {
  const { t } = useTranslation()
  const {
    setValue,
    getValues,
    formState: { dirtyFields },
    control,
  } = useFormContext<EditCourseFormValues>()

  // oxlint-disable-next-line i18next/no-literal-string
  const isClosed = useWatch({ name: "set_course_closed_at", control })

  // We purposefully do NOT clear related values when unchecked. Instead, we nullify `closed_at`
  // at submit time (see submit mapping), so users can re-check and keep their previous inputs.
  // Gated on `dirtyFields` so loading an already-closed course doesn't overwrite `closed_at` the
  // moment this mounts.
  useEffect(() => {
    if (!dirtyFields.set_course_closed_at || !isClosed) {
      return
    }
    const currentClosedAt = getValues("closed_at")
    if (!currentClosedAt) {
      setValue("closed_at", formatDateForDateTimeLocalInputs(new Date()) ?? null)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isClosed])

  return (
    <>
      <FieldContainer>
        <Checkbox name="set_course_closed_at" control={control} label={t("set-course-closed-at")} />
      </FieldContainer>
      {isClosed && (
        <>
          <FieldContainer>
            <DateTimeLocalField
              control={control}
              label={t("closed-at")}
              name="closed_at"
              rules={nullIfEmpty}
            />
          </FieldContainer>
          <FieldContainer>
            <TextArea
              name="closed_additional_message"
              control={control}
              label={t("closed-additional-message")}
            />
          </FieldContainer>
          <FieldContainer>
            <TextField
              name="closed_course_successor_id"
              control={control}
              label={t("closed-course-successor-id")}
              rules={{
                validate: (value) => {
                  if (!value) {
                    return true
                  }
                  return validateUUID(value) || t("invalid-uuid-format")
                },
              }}
            />
          </FieldContainer>
        </>
      )}
    </>
  )
}

export default ClosedSectionFields
