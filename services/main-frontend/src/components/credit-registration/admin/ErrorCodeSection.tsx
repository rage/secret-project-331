"use client"

import { css, cx } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationErrorCode } from "@/generated/api/types.generated"
import { Badge, Button, Link, QueryResult, RelativeTime, Table } from "@/shared-module/components"

import {
  ALIGN_END,
  BADGE_COMPACT,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  LINK_QUIET,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_IN_TITLE,
  TONE,
} from "../constants"
import { failureOwner, failureOwnerLabel } from "../registrationFailures"
import {
  codeValueCss,
  controlCss,
  controlsCss,
  noteCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import {
  adminErrorShortLabel,
  retryabilityLabel,
  retryabilityTone,
} from "./adminCreditRegistrationCopy"
import { useCreditRegistrationErrorsByCode } from "./adminCreditRegistrationHooks"
import { registrationsListHref } from "./registrationsListUrl"
import { DAY_SECS, useWindowSecsParam, WindowSecsSelect } from "./WindowSecsSelect"

const signed = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta))

const risingCss = css`
  color: var(--color-crimson-700);
  font-variant-numeric: tabular-nums;
`

const fallingCss = css`
  color: var(--color-green-700);
  font-variant-numeric: tabular-nums;
`

/**
 * Which error codes the window's failures ended on, against the previous window. The counts are
 * failure events; "Registrations now" is the live rows carrying the code, which is what its link
 * and `onSelectRows` act on.
 */
const ErrorCodeSection: React.FC<{
  onSelectRows: (errorCode: CreditRegistrationErrorCode) => void
}> = ({ onSelectRows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const { control, windowSecs } = useWindowSecsParam(DAY_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)
  const codes = errorsQuery.data?.codes ?? []
  const failureCount = codes.reduce((sum, row) => sum + row.current_count, 0)

  return (
    <div className={subsectionCss}>
      <h3 id={headingId} className={subheadingCss}>
        {t("credit-registration-heading-error-codes")}
      </h3>
      <div className={controlsCss}>
        <div className={controlCss}>
          <WindowSecsSelect control={control} includeMonth />
        </div>
      </div>
      {errorsQuery.data && (
        <p className={noteCss}>
          {t("credit-registration-admin-error-code-summary", {
            codes: codes.length,
            failures: failureCount,
          })}
        </p>
      )}
      <QueryResult query={errorsQuery} refreshIndicator={QUIET_REFRESH}>
        {(errors) => {
          // Every row is "new" when there was no previous window to compare against, and a
          // marker on every row marks nothing.
          const hadPreviousWindow = errors.codes.some((row) => row.previous_count > 0)
          return (
            <Table
              labelledBy={headingId}
              density={DENSITY_COMPACT}
              rowKey={(row) => row.error_code}
              rows={errors.codes}
              emptyState={t("credit-registration-admin-no-errors-in-window")}
              responsive={TABLE_STACK}
              columns={[
                {
                  header: t("credit-registration-admin-column-what-failed"),
                  grow: 2,
                  minWidth: "14rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <span>{adminErrorShortLabel(t, row.error_code)}</span>
                      <code className={cx(noteCss, codeValueCss)}>{row.error_code}</code>
                    </span>
                  ),
                },
                {
                  header: t("credit-registration-admin-column-who-fixes-this"),
                  minWidth: "9rem",
                  cell: (row) => failureOwnerLabel(t, failureOwner(row.error_code)),
                },
                {
                  header: t("credit-registration-admin-column-retryability"),
                  minWidth: "9rem",
                  // A pill on every row is chrome; only the codes an admin must fix earn one.
                  cell: (row) => {
                    const label = retryabilityLabel(t, row.retryability)
                    return retryabilityTone(row.retryability) === TONE.DANGER ? (
                      <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
                        {label}
                      </Badge>
                    ) : (
                      label
                    )
                  },
                },
                {
                  header: t("credit-registration-admin-column-in-window"),
                  align: ALIGN_END,
                  minWidth: "6rem",
                  nowrap: true,
                  cell: (row) => row.current_count,
                },
                {
                  header: t("credit-registration-admin-column-change"),
                  align: ALIGN_END,
                  minWidth: "6rem",
                  nowrap: true,
                  cell: (row) => {
                    const delta = row.current_count - row.previous_count
                    if (hadPreviousWindow && row.previous_count === 0) {
                      return t("credit-registration-admin-new-this-window")
                    }
                    return (
                      <span className={delta > 0 ? risingCss : delta < 0 ? fallingCss : noteCss}>
                        {signed(delta)}
                      </span>
                    )
                  },
                },
                {
                  header: t("credit-registration-admin-column-students"),
                  align: ALIGN_END,
                  minWidth: "5rem",
                  nowrap: true,
                  cell: (row) => row.user_count,
                },
                {
                  header: t("credit-registration-admin-column-courses"),
                  align: ALIGN_END,
                  minWidth: "5rem",
                  nowrap: true,
                  cell: (row) => row.course_count,
                },
                {
                  header: t("credit-registration-admin-column-last-seen"),
                  minWidth: "8rem",
                  nowrap: true,
                  cell: (row) => (
                    <RelativeTime at={row.last_seen_at} absoluteTime={TIME_IN_TITLE} />
                  ),
                },
                {
                  header: t("credit-registration-admin-column-registrations-now"),
                  align: ALIGN_END,
                  minWidth: "9rem",
                  cell: (row) =>
                    row.live_count === 0 ? null : (
                      <span className={stackedCellCss}>
                        <Link
                          href={registrationsListHref({ errorCodes: [row.error_code] })}
                          appearance={LINK_QUIET}
                        >
                          {row.live_count}
                        </Link>
                        <Button
                          variant={BUTTON_TERTIARY}
                          size="small"
                          onClick={() => onSelectRows(row.error_code)}
                        >
                          {t("credit-registration-admin-select-these-rows")}
                        </Button>
                      </span>
                    ),
                },
              ]}
            />
          )
        }}
      </QueryResult>
    </div>
  )
}

export default ErrorCodeSection
