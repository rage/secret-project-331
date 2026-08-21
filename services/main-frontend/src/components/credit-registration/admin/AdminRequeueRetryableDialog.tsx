"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { adminRequeueRetryableCreditRegistrations } from "@/generated/api/sdk.generated"
import type { AdminRequeueRetryableResult } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Infobox, Select } from "@/shared-module/components"

import { MIDDLE_DOT, TONE } from "../constants"
import { noteCss } from "../styles"
import { AdminActionDialog } from "./AdminActionDialog"
import {
  useCreditRegistrationCourseStats,
  useInvalidateAttentionItems,
} from "./adminCreditRegistrationHooks"
import { ReasonField } from "./ReasonConfirmDialog"

interface Fields {
  course_module_id: string
  reason: string
}

// oxlint-disable-next-line i18next/no-literal-string
const EVERY_MODULE = ""

/** Clears the backoff on every retryable row, which is the button to press once an outage is over. */
const AdminRequeueRetryableDialog: React.FC = () => {
  const { t } = useTranslation()
  const courseStatsQuery = useCreditRegistrationCourseStats()
  const invalidateAttentionItems = useInvalidateAttentionItems()

  return (
    <AdminActionDialog<Fields, AdminRequeueRetryableResult>
      triggerLabel={t("button-text-credit-registration-requeue-retryable")}
      dialogTitle={t("button-text-credit-registration-requeue-retryable")}
      defaultValues={{ course_module_id: EVERY_MODULE, reason: "" }}
      mutationFn={(fields) =>
        adminRequeueRetryableCreditRegistrations({
          body: {
            ...includeIf(fields.course_module_id !== EVERY_MODULE, {
              course_module_id: fields.course_module_id,
            }),
            reason: fields.reason,
          },
        })
      }
      onSuccess={() => void invalidateAttentionItems()}
      renderFields={(control) => (
        <>
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
        </>
      )}
      renderResult={(result) => (
        <Infobox tone={TONE.INFO}>
          {t("credit-registration-admin-requeued", {
            count: result.requeued_count,
            max: result.max_rows_per_call,
          })}
        </Infobox>
      )}
    />
  )
}

export default AdminRequeueRetryableDialog
