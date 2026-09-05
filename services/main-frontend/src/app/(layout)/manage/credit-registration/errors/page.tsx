"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  retryabilityLabel,
  retryabilityTone,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationReconciliation,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminRequeueRetryableDialog from "@/components/credit-registration/admin/AdminRequeueRetryableDialog"
import AttentionQueueSection from "@/components/credit-registration/admin/AttentionQueueSection"
import { formatSharePercent } from "@/components/credit-registration/admin/percent"
import ReconciliationSection from "@/components/credit-registration/admin/ReconciliationSection"
import {
  DAY_SECS,
  useWindowSecsParam,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  ALIGN_END,
  DENSITY_COMPACT,
  LINK_QUIET,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  proseCss,
  sectionCss,
  spacedRowCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Link,
  Meter,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const ERROR_CODE_QUERY = "?error_code="

const signed = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta))

/** How the window's finished registrations ended, and which error codes account for the failures. */
const FailureSection: React.FC = () => {
  const { t } = useTranslation()
  const { control, windowSecs } = useWindowSecsParam(DAY_SECS)
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-verdicts")}</h2>
      <div className={controlsCss}>
        <div className={controlCss}>
          <WindowSecsSelect control={control} includeMonth />
        </div>
      </div>
      <QueryResult query={errorsQuery} refreshIndicator={QUIET_REFRESH}>
        {(errors) => {
          const verdicts = errors.verdicts
          const successCount = verdicts.registered_count + verdicts.duplicate_and_not_improved_count
          return (
            <>
              <StatTileList ariaLabel={t("credit-registration-heading-verdicts")}>
                <StatTile
                  label={t("credit-registration-admin-column-registered")}
                  value={verdicts.registered_count}
                />
                <StatTile
                  label={t("credit-registration-admin-verdict-duplicate-or-not-improved")}
                  value={verdicts.duplicate_and_not_improved_count}
                />
                <StatTile
                  label={t("credit-registration-admin-column-failed")}
                  value={verdicts.failed_permanent_count}
                  alertWhenNonZero
                />
                <StatTile
                  label={t("credit-registration-admin-verdict-cancelled")}
                  value={verdicts.cancelled_count}
                />
              </StatTileList>
              {verdicts.total_count > 0 && (
                <Meter
                  className={proseCss}
                  label={t("credit-registration-admin-success-rate")}
                  value={successCount}
                  maxValue={verdicts.total_count}
                  valueLabel={formatSharePercent(successCount, verdicts.total_count)}
                  tone={TONE.SUCCESS}
                />
              )}
              <div className={subsectionCss}>
                <div className={spacedRowCss}>
                  <h3 className={subheadingCss}>{t("credit-registration-heading-error-codes")}</h3>
                  <AdminRequeueRetryableDialog />
                </div>
                <p className={cx(noteCss, proseCss)}>
                  {t("credit-registration-admin-requeue-note")}
                </p>
                <Table
                  caption={t("credit-registration-heading-error-codes")}
                  density={DENSITY_COMPACT}
                  rowKey={(row) => row.error_code}
                  rows={errors.codes}
                  emptyState={t("credit-registration-admin-no-errors-in-window")}
                  columns={[
                    {
                      header: t("label-error-code"),
                      grow: true,
                      minWidth: "14rem",
                      cell: (row) => (
                        <Link
                          href={`${creditRegistrationRegistrationsRoute()}${ERROR_CODE_QUERY}${row.error_code}`}
                          appearance={LINK_QUIET}
                        >
                          <code>{row.error_code}</code>
                        </Link>
                      ),
                    },
                    {
                      header: t("credit-registration-admin-column-retryability"),
                      minWidth: "9rem",
                      cell: (row) => (
                        <Badge tone={retryabilityTone(row.retryability)} size="compact">
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
                      // A count and a "new" marker in the same cell, so the column stays numeric.
                      cell: (row) => (
                        <span>
                          {signed(row.current_count - row.previous_count)}
                          {row.previous_count === 0 && (
                            <>
                              {" "}
                              <Badge tone={TONE.NEUTRAL} size="compact">
                                {t("credit-registration-admin-new-this-window")}
                              </Badge>
                            </>
                          )}
                        </span>
                      ),
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
              </div>
            </>
          )
        }}
      </QueryResult>
    </section>
  )
}

/** The queue a human works from, then the window's failure report, then the drift nothing else sees. */
const ErrorsPage: React.FC = () => {
  const reconciliationQuery = useCreditRegistrationReconciliation()

  return (
    <>
      <AttentionQueueSection />
      <FailureSection />
      <QueryResult query={reconciliationQuery} refreshIndicator={QUIET_REFRESH}>
        {(reconciliation) => <ReconciliationSection reconciliation={reconciliation} />}
      </QueryResult>
    </>
  )
}

export default ErrorsPage
