"use client"

import Link from "next/link"
import React, { useCallback, useEffect } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AdminBulkTransitionDialog from "@/components/credit-registration/admin/AdminBulkTransitionDialog"
import {
  attentionReasonLabel,
  isAttentionReason,
  retryabilityLabel,
  retryabilityTone,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationAttentionItems,
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationReconciliation,
  useCreditRegistrationThresholds,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminRequeueRetryableDialog from "@/components/credit-registration/admin/AdminRequeueRetryableDialog"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import { formatSharePercent } from "@/components/credit-registration/admin/percent"
import ReconciliationSection from "@/components/credit-registration/admin/ReconciliationSection"
import { useQueryParamFilters } from "@/components/credit-registration/admin/useQueryParamFilters"
import {
  DAY_SECS,
  useWindowSecsParam,
  WindowSecsSelect,
} from "@/components/credit-registration/admin/WindowSecsSelect"
import {
  ALIGN_END,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  emptyStateCss,
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
  toolbarCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationAttentionItems,
  CreditRegistrationAttentionReason,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import {
  creditRegistrationItemRoute,
  creditRegistrationRegistrationsRoute,
} from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"
import { formatDuration } from "@/utils/moduleTimeline"

// oxlint-disable-next-line i18next/no-literal-string
const ERROR_CODE_QUERY = "?error_code="
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_REASON = "reason"

interface SelectionFields {
  selectAll: boolean
  selected: Record<string, boolean>
}

/** The reason chip, kept in the query string so the Overview's "stuck" tile can deep-link in. */
const useAttentionReasonFilter = () => {
  const { param, applyParams } = useQueryParamFilters()
  // Validated, not cast: an unknown reason filters the table to nothing, which the page then
  // reports as "nothing needs a human".
  const rawReason = param(PARAM_REASON)
  const activeReason = isAttentionReason(rawReason) ? rawReason : undefined
  const toggleReason = (reason: CreditRegistrationAttentionReason) =>
    applyParams({ [PARAM_REASON]: activeReason === reason ? undefined : reason })
  return { activeReason, toggleReason }
}

const signed = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta))

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
                {verdicts.total_count > 0 && (
                  <StatTile
                    label={t("credit-registration-admin-success-rate")}
                    value={formatSharePercent(successCount, verdicts.total_count)}
                  />
                )}
              </StatTileList>
              <div className={subsectionCss}>
                <h3 className={subheadingCss}>{t("credit-registration-heading-error-codes")}</h3>
                {errors.codes.length === 0 ? (
                  <p className={emptyStateCss}>
                    {t("credit-registration-admin-no-errors-in-window")}
                  </p>
                ) : (
                  <Table
                    caption={t("credit-registration-heading-error-codes")}
                    rowKey={(row) => row.error_code}
                    rows={errors.codes}
                    columns={[
                      {
                        header: t("label-error-code"),
                        cell: (row) => (
                          <Link
                            href={`${creditRegistrationRegistrationsRoute()}${ERROR_CODE_QUERY}${row.error_code}`}
                            prefetch={false}
                          >
                            <code>{row.error_code}</code>
                          </Link>
                        ),
                      },
                      {
                        header: t("credit-registration-admin-column-retryability"),
                        cell: (row) => (
                          <Badge tone={retryabilityTone(row.retryability)}>
                            {retryabilityLabel(t, row.retryability)}
                          </Badge>
                        ),
                      },
                      {
                        header: t("credit-registration-admin-column-in-window"),
                        align: ALIGN_END,
                        cell: (row) => row.current_count,
                      },
                      {
                        header: t("credit-registration-admin-column-change"),
                        align: ALIGN_END,
                        cell: (row) =>
                          row.previous_count === 0
                            ? t("credit-registration-admin-new-this-window")
                            : signed(row.current_count - row.previous_count),
                      },
                      {
                        header: t("credit-registration-admin-column-students"),
                        align: ALIGN_END,
                        cell: (row) => row.user_count,
                      },
                      {
                        header: t("credit-registration-admin-column-courses"),
                        align: ALIGN_END,
                        cell: (row) => row.course_count,
                      },
                      {
                        header: t("credit-registration-admin-column-last-seen"),
                        cell: (row) => (
                          <RelativeTime at={row.last_seen_at} absoluteTime={TIME_IN_TITLE} />
                        ),
                      },
                    ]}
                  />
                )}
              </div>
              <div className={rowCss}>
                <AdminRequeueRetryableDialog />
              </div>
            </>
          )
        }}
      </QueryResult>
    </section>
  )
}

const ReasonFilter: React.FC<{
  attention: CreditRegistrationAttentionItems
  activeReason: CreditRegistrationAttentionReason | undefined
  toggleReason: (reason: CreditRegistrationAttentionReason) => void
}> = ({ attention, activeReason, toggleReason }) => {
  const { t } = useTranslation()
  const groups = attention.counts_by_reason.filter((group) => group.count > 0)
  if (groups.length === 0) {
    return null
  }
  return (
    <div className={rowCss}>
      {groups.map((group) => (
        <Button
          key={group.reason}
          variant={activeReason === group.reason ? "secondary" : "tertiary"}
          size="small"
          aria-pressed={activeReason === group.reason}
          onClick={() => toggleReason(group.reason)}
        >
          {`${attentionReasonLabel(t, group.reason)}${MIDDLE_DOT}${group.count}`}
        </Button>
      ))}
    </div>
  )
}

const AttentionSection: React.FC<{ attention: CreditRegistrationAttentionItems }> = ({
  attention,
}) => {
  const { t } = useTranslation()
  const { activeReason, toggleReason } = useAttentionReasonFilter()
  const thresholdsQuery = useCreditRegistrationThresholds()
  const { control, watch, reset, setValue } = useForm<SelectionFields>({
    defaultValues: { selectAll: false, selected: {} },
  })
  const selected = watch("selected")
  const selectAll = watch("selectAll")
  const clearSelection = useCallback(() => reset({ selectAll: false, selected: {} }), [reset])
  const thresholds = thresholdsQuery.data

  const items =
    activeReason === undefined
      ? attention.items
      : attention.items.filter((item) => item.reasons.includes(activeReason))
  const visibleIds = items.map((item) => item.credit_registration_id)
  // Read off the rows on screen, so a tick the reason chip has since hidden cannot reach the bulk
  // dialog, and the header box's indeterminate state counts the set the table actually shows.
  const selectedIds = visibleIds.filter((id) => selected[id])

  // Only when the header box itself is toggled: reacting to `visibleIds` would clear the selection
  // on every poll.
  useEffect(() => {
    setValue("selected", Object.fromEntries(visibleIds.map((id) => [id, selectAll] as const)))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAll])

  // A chip changes which rows exist to act on; ticks it hides would otherwise reappear in the
  // toolbar's count later, once the chip is cleared again.
  useEffect(() => {
    clearSelection()
  }, [activeReason, clearSelection])

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-attention")}</h2>
      <ReasonFilter attention={attention} activeReason={activeReason} toggleReason={toggleReason} />
      <StatTileList ariaLabel={t("credit-registration-heading-attention")}>
        <StatTile
          label={t("label-credit-registration-needs-attention")}
          value={attention.total_count}
          alertWhenNonZero
        />
      </StatTileList>
      {attention.total_count >= attention.max_items && (
        <p className={noteCss}>
          {t("credit-registration-admin-attention-capped", { max: attention.max_items })}
        </p>
      )}
      {items.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-nothing-needs-a-human")}</p>
      ) : (
        <>
          <Table
            caption={t("credit-registration-heading-attention")}
            rowKey={(row) => row.credit_registration_id}
            rows={items}
            columns={[
              {
                header: (
                  <Checkbox
                    name="selectAll"
                    control={control}
                    isIndeterminate={selectedIds.length > 0 && selectedIds.length < items.length}
                    label={
                      <VisuallyHidden>
                        {t("credit-registration-admin-select-every-row")}
                      </VisuallyHidden>
                    }
                  />
                ),
                cell: (row) => (
                  <Checkbox
                    name={`selected.${row.credit_registration_id}`}
                    control={control}
                    label={
                      <VisuallyHidden>
                        {t("credit-registration-admin-select-registration", {
                          student: formatUserName(row),
                        })}
                      </VisuallyHidden>
                    }
                  />
                ),
              },
              {
                header: t("label-student"),
                cell: (row) => (
                  <span className={stackedCellCss}>
                    <Link
                      href={creditRegistrationItemRoute(row.credit_registration_id)}
                      prefetch={false}
                    >
                      {formatUserName(row)}
                    </Link>
                    <span className={noteCss}>{row.email}</span>
                  </span>
                ),
              },
              {
                header: t("label-course"),
                cell: (row) => (
                  <span className={stackedCellCss}>
                    <span>{row.course_name}</span>
                    <span className={noteCss}>{row.course_module_name}</span>
                  </span>
                ),
              },
              {
                header: t("label-state"),
                cell: (row) => (
                  <span className={stackedCellCss}>
                    <AdminStateBadge state={row.state} />
                    {row.error_code && <code>{row.error_code}</code>}
                  </span>
                ),
              },
              {
                header: t("credit-registration-admin-column-reasons"),
                cell: (row) => (
                  <span className={rowCss}>
                    {row.reasons.map((reason) => (
                      <Badge key={reason} tone={TONE.NEUTRAL}>
                        {attentionReasonLabel(t, reason)}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              {
                header: t("label-credit-registration-time-in-state"),
                cell: (row) => (
                  <RelativeTime at={row.state_entered_at} absoluteTime={TIME_IN_TITLE} />
                ),
              },
              {
                header: t("credit-registration-admin-column-next-attempt"),
                cell: (row) => (
                  <RelativeTime at={row.next_attempt_at} absoluteTime={TIME_IN_TITLE} />
                ),
              },
            ]}
          />
          {selectedIds.length > 0 && (
            <div className={toolbarCss}>
              <div className={rowCss}>
                <span>
                  {t("credit-registration-admin-selected-count", { count: selectedIds.length })}
                </span>
                <AdminBulkTransitionDialog selectedIds={selectedIds} onApplied={clearSelection} />
                <Button variant="tertiary" size="medium" onClick={clearSelection}>
                  {t("credit-registration-admin-clear-selection")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {thresholds && (
        <p className={noteCss}>
          {t("credit-registration-admin-stuck-thresholds", {
            readyToSubmit: formatDuration(thresholds.stuck_ready_to_submit_secs, t),
            submitting: formatDuration(thresholds.stuck_submitting_secs, t),
            awaitingVerification: formatDuration(thresholds.stuck_awaiting_verification_secs, t),
            failedRetryable: formatDuration(thresholds.stuck_failed_retryable_secs, t),
          })}
        </p>
      )}
    </section>
  )
}

/** What is breaking, who must act on it, and what has silently drifted: one incident, read top down. */
const ErrorsPage: React.FC = () => {
  const attentionQuery = useCreditRegistrationAttentionItems()
  const reconciliationQuery = useCreditRegistrationReconciliation()

  return (
    <>
      <QueryResult query={attentionQuery} refreshIndicator={QUIET_REFRESH}>
        {(attention) => <AttentionSection attention={attention} />}
      </QueryResult>
      <FailureSection />
      <QueryResult query={reconciliationQuery} refreshIndicator={QUIET_REFRESH}>
        {(reconciliation) => <ReconciliationSection reconciliation={reconciliation} />}
      </QueryResult>
    </>
  )
}

export default ErrorsPage
