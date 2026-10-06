"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { SuotarApiCallRow, SuotarEndpoint } from "@/generated/api/types.generated"
import type { TableColumn } from "@/shared-module/components"

import { ABSENT, ALIGN_END, CREDIT_REGISTRATION_NS } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import { codeValueCss, noteCss, stackedCellCss } from "../styles"
import { suotarEndpointLabel } from "./adminCreditRegistrationCopy"
import { TONE_INK } from "./AdminStateLabel"
import HttpStatusBadge from "./HttpStatusBadge"

type CallOutcome = Pick<
  SuotarApiCallRow,
  "http_status" | "succeeded" | "request_level_error_code" | "duration_ms"
>

type ItemCounts = Pick<
  SuotarApiCallRow,
  "ok_item_count" | "pending_item_count" | "error_item_count"
>

/** The endpoint in plain words over its wire name, which is what the logs and filters use. */
export const SuotarEndpointCell: React.FC<{ endpoint: SuotarEndpoint }> = ({ endpoint }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{suotarEndpointLabel(t, endpoint)}</span>
      <code className={cx(noteCss, codeValueCss)}>{endpoint}</code>
    </span>
  )
}

/** Whether the request itself went through, with the registry's request-level code under it. */
export const CallStatusCell: React.FC<{ call: CallOutcome }> = ({ call }) => (
  <span className={stackedCellCss}>
    <HttpStatusBadge httpStatus={call.http_status} succeeded={call.succeeded} />
    {call.request_level_error_code && (
      <code className={cx(noteCss, codeValueCss)}>{call.request_level_error_code}</code>
    )}
  </span>
)

/** How long the call took, in milliseconds. */
export const tookColumn = <T extends CallOutcome>(
  t: CreditRegistrationTFunction,
): TableColumn<T> => ({
  header: t("credit-registration-admin-column-duration-ms"),
  align: ALIGN_END,
  nowrap: true,
  cell: (call) => call.duration_ms ?? ABSENT,
})

/** The batch's OK / Waiting / Failed item counts; Failed is tinted only when there are any. */
export const itemCountColumns = <T extends ItemCounts>(
  t: CreditRegistrationTFunction,
): TableColumn<T>[] => [
  {
    header: t("credit-registration-admin-column-ok"),
    align: ALIGN_END,
    nowrap: true,
    cell: (call) => call.ok_item_count,
  },
  {
    header: t("credit-registration-admin-column-waiting"),
    align: ALIGN_END,
    nowrap: true,
    cell: (call) => call.pending_item_count,
  },
  {
    header: t("credit-registration-admin-column-failed"),
    align: ALIGN_END,
    nowrap: true,
    cell: (call) =>
      call.error_item_count > 0 ? (
        <span className={TONE_INK.failed}>{call.error_item_count}</span>
      ) : (
        call.error_item_count
      ),
  },
]
