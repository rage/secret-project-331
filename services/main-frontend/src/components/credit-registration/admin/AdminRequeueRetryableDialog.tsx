"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { adminRequeueRetryableCreditRegistrations } from "@/generated/api/sdk.generated"
import type { AdminRequeueRetryableResult } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Button, Dialog, Infobox, Select } from "@/shared-module/components"

import { MIDDLE_DOT, TONE } from "../constants"
import { noteCss } from "../styles"
import {
  useCreditRegistrationCourseStats,
  useInvalidateAttentionItems,
} from "./adminCreditRegistrationHooks"
import { ReasonField, isReasonConfirmDisabled, useReasonRequiredForm } from "./ReasonConfirmDialog"

interface Fields {
  course_module_id: string
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const EVERY_MODULE = ""

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const rootCss = css`
  display: grid;
  gap: 0.75rem;
  justify-items: start;
`

/** Clears the backoff on every retryable row, which is the button to press once an outage is over. */
const AdminRequeueRetryableDialog: React.FC = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<AdminRequeueRetryableResult | null>(null)
  const courseStatsQuery = useCreditRegistrationCourseStats()
  const invalidateAttentionItems = useInvalidateAttentionItems()
  const { control, handleSubmit, watch } = useReasonRequiredForm<Fields>({
    course_module_id: EVERY_MODULE,
    reason: "",
  })
  const reason = watch("reason")

  const mutation = useToastMutation(
    (fields: Fields) =>
      adminRequeueRetryableCreditRegistrations({
        body: {
          ...includeIf(fields.course_module_id !== EVERY_MODULE, {
            course_module_id: fields.course_module_id,
          }),
          reason: fields.reason,
        },
      }),
    { notify: false },
    {
      onSuccess: (data) => {
        setResult(data)
        setOpen(false)
        void invalidateAttentionItems()
      },
    },
  )

  return (
    <div className={rootCss}>
      <Button variant="secondary" size="medium" onClick={() => setOpen(true)}>
        {t("button-text-credit-registration-requeue-retryable")}
      </Button>
      {result && (
        <Infobox tone={TONE.INFO}>
          {t("credit-registration-admin-requeued", {
            count: result.requeued_count,
            max: result.max_rows_per_call,
          })}
        </Infobox>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("button-text-credit-registration-requeue-retryable")}
      >
        <form className={formCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
          <p className={noteCss}>{t("credit-registration-admin-requeue-note")}</p>
          <Select
            name="course_module_id"
            control={control}
            label={t("credit-registration-admin-requeue-scope")}
            options={[
              { value: EVERY_MODULE, label: t("credit-registration-admin-requeue-every-module") },
              ...(courseStatsQuery.data?.modules ?? []).map((module) => ({
                value: module.course_module_id,
                label: `${module.course_name}${MIDDLE_DOT}${module.course_module_name ?? module.course_module_id}`,
              })),
            ]}
          />
          <ReasonField control={control} />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={isReasonConfirmDisabled(mutation.isPending, reason)}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </div>
  )
}

export default AdminRequeueRetryableDialog
