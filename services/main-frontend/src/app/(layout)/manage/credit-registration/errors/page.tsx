"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  retryabilityLabel,
  retryabilityTone,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useCreditRegistrationErrorsByCode } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AttentionQueueSection from "@/components/credit-registration/admin/AttentionQueueSection"
import {
  DAY_SECS,
  useWindowSecsParam,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  ALIGN_END,
  BADGE_COMPACT,
  DENSITY_COMPACT,
  LINK_QUIET,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
} from "@/components/credit-registration/constants"
import { registrationErrorShortLabel } from "@/components/credit-registration/creditRegistrationCopy"
import {
  failureOwner,
  failureOwnerLabel,
} from "@/components/credit-registration/registrationFailures"
import {
  controlCss,
  controlsCss,
  monospaceCss,
  noteCss,
  sectionCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Disclosure,
  Link,
  QueryResult,
  RelativeTime,
  Table,
} from "@/shared-module/components"

const ERROR_CODE_QUERY = "?error_code="

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
 * Which error codes the window's failures ended on, collapsed: the queue below is the work, and
 * this is the report an operator opens once they want to know what keeps happening.
 */
const ErrorCodeSummary: React.FC = () => {
  const { t } = useTranslation()
  const { control, windowSecs } = useWindowSecsParam(DAY_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)
  const codes = errorsQuery.data?.codes ?? []
  const failureCount = codes.reduce((sum, row) => sum + row.current_count, 0)

  return (
    <section className={sectionCss}>
      <Disclosure
        title={t("credit-registration-heading-error-codes")}
        summary={
          errorsQuery.data
            ? t("credit-registration-admin-error-code-summary", {
                codes: codes.length,
                failures: failureCount,
              })
            : undefined
        }
      >
        <div className={sectionCss}>
          <div className={controlsCss}>
            <div className={controlCss}>
              <WindowSecsSelect control={control} includeMonth />
            </div>
          </div>
          <QueryResult query={errorsQuery} refreshIndicator={QUIET_REFRESH}>
            {(errors) => {
              // Every row is "new" when there was no previous window to compare against, and a
              // marker on every row marks nothing.
              const hadPreviousWindow = errors.codes.some((row) => row.previous_count > 0)
              return (
                <Table
                  caption={t("credit-registration-heading-error-codes")}
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
                        <Link
                          href={`${creditRegistrationRegistrationsRoute()}${ERROR_CODE_QUERY}${row.error_code}`}
                          appearance={LINK_QUIET}
                        >
                          <span className={stackedCellCss}>
                            <span>{registrationErrorShortLabel(t, row.error_code)}</span>
                            <code className={cx(noteCss, monospaceCss)}>{row.error_code}</code>
                          </span>
                        </Link>
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
                      cell: (row) => (
                        <Badge tone={retryabilityTone(row.retryability)} size={BADGE_COMPACT}>
                          {retryabilityLabel(t, row.retryability)}
                        </Badge>
                      ),
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
                          <span
                            className={delta > 0 ? risingCss : delta < 0 ? fallingCss : noteCss}
                          >
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
                        <RelativeTime at={row.last_seen_at} absoluteTime={TIME_COMPACT} />
                      ),
                    },
                  ]}
                />
              )
            }}
          </QueryResult>
        </div>
      </Disclosure>
    </section>
  )
}

/** The queue a human works from, and nothing else: throughput and the Sisu checks are the Overview's. */
const ErrorsPage: React.FC = () => (
  <>
    <ErrorCodeSummary />
    <AttentionQueueSection />
  </>
)

export default ErrorsPage
