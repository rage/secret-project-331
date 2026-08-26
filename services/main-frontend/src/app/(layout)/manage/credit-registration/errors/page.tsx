"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { VisuallyHidden } from "react-aria"
import type { Control } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AdminBulkTransitionDialog from "@/components/credit-registration/admin/AdminBulkTransitionDialog"
import {
  attentionReasonLabel,
  retryabilityLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationAttentionItems,
  useCreditRegistrationErrorsByCode,
  useCreditRegistrationThresholds,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminRequeueRetryableDialog from "@/components/credit-registration/admin/AdminRequeueRetryableDialog"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import { DAY_SECS, WindowSecsSelect } from "@/components/credit-registration/admin/WindowSecsSelect"
import { MIDDLE_DOT, TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  stackedCellCss,
  tilesCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationAttentionItem,
  CreditRegistrationAttentionItems,
  CreditRegistrationAttentionReason,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Checkbox,
  Disclosure,
  QueryResult,
  StatTile,
  Table,
} from "@/shared-module/components"

const PERCENT = 100

const controlsCss = css`
  max-width: 16rem;
`

const actionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: start;
`

const reasonsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`

interface WindowFields {
  window_secs: string
}

interface SelectionFields {
  selected: Record<string, boolean>
}

const VerdictSection: React.FC<{ windowSecs: number }> = ({ windowSecs }) => {
  const { t } = useTranslation()
  const errorsQuery = useCreditRegistrationErrorsByCode(windowSecs)
  return (
    <QueryResult query={errorsQuery}>
      {(errors) => {
        const verdicts = errors.verdicts
        const successCount = verdicts.registered_count + verdicts.duplicate_and_not_improved_count
        return (
          <>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("credit-registration-heading-verdicts")}</h2>
              <div className={tilesCss}>
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
                  {...includeIf(verdicts.failed_permanent_count > 0, { tone: TONE.ALERT })}
                />
                <StatTile
                  label={t("credit-registration-admin-verdict-cancelled")}
                  value={verdicts.cancelled_count}
                />
                <StatTile
                  label={t("credit-registration-admin-column-abandoned")}
                  value={verdicts.abandoned_by_consent_withdrawal_count}
                />
                <StatTile
                  label={t("credit-registration-admin-success-rate")}
                  value={
                    verdicts.total_count === 0
                      ? ABSENT
                      : `${Math.round((successCount / verdicts.total_count) * PERCENT)} %`
                  }
                />
              </div>
              <p className={noteCss}>{t("credit-registration-admin-verdicts-note")}</p>
            </section>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("credit-registration-heading-error-codes")}</h2>
              {errors.codes.length === 0 ? (
                <p className={noteCss}>{t("credit-registration-admin-no-errors-in-window")}</p>
              ) : (
                <Table
                  caption={t("credit-registration-heading-error-codes")}
                  rowKey={(row) => row.error_code}
                  rows={errors.codes}
                  columns={[
                    { header: t("label-error-code"), cell: (row) => <code>{row.error_code}</code> },
                    {
                      header: t("credit-registration-admin-column-retryability"),
                      cell: (row) => (
                        <Badge tone={TONE.NEUTRAL}>{retryabilityLabel(t, row.retryability)}</Badge>
                      ),
                    },
                    {
                      header: t("credit-registration-admin-column-in-window"),
                      cell: (row) => row.current_count,
                    },
                    {
                      header: t("credit-registration-admin-column-window-before"),
                      cell: (row) => row.previous_count,
                    },
                    {
                      header: t("credit-registration-admin-column-students"),
                      cell: (row) => row.user_count,
                    },
                    {
                      header: t("credit-registration-admin-column-courses"),
                      cell: (row) => row.course_count,
                    },
                    {
                      header: t("label-endpoint"),
                      cell: (row) =>
                        row.endpoints.map((endpoint) => <code key={endpoint}>{endpoint}</code>),
                    },
                    {
                      header: t("credit-registration-admin-column-first-seen"),
                      cell: (row) => <RelativeTime at={row.first_seen_at} />,
                    },
                    {
                      header: t("credit-registration-admin-column-last-seen"),
                      cell: (row) => <RelativeTime at={row.last_seen_at} />,
                    },
                  ]}
                />
              )}
            </section>
          </>
        )
      }}
    </QueryResult>
  )
}

const AttentionTable: React.FC<{
  reason: CreditRegistrationAttentionReason
  items: CreditRegistrationAttentionItem[]
  control: Control<SelectionFields>
}> = ({ reason, items, control }) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={t("credit-registration-admin-attention-of-reason", {
        reason: attentionReasonLabel(t, reason),
      })}
      rowKey={(row) => row.credit_registration_id}
      rows={items}
      columns={[
        {
          header: t("credit-registration-admin-column-select"),
          cell: (row) => (
            <Checkbox
              name={`selected.${row.credit_registration_id}`}
              control={control}
              label={
                <VisuallyHidden>
                  {t("credit-registration-admin-select-registration", {
                    student: [row.first_name, row.last_name].filter(Boolean).join(" "),
                  })}
                </VisuallyHidden>
              }
            />
          ),
        },
        {
          header: t("label-state"),
          cell: (row) => (
            <Link href={creditRegistrationItemRoute(row.credit_registration_id)} prefetch={false}>
              <AdminStateBadge state={row.state} />
            </Link>
          ),
        },
        {
          header: t("credit-registration-admin-column-reasons"),
          cell: (row) => (
            <span className={reasonsCss}>
              {row.reasons.map((each) => (
                <Badge key={each} tone={TONE.NEUTRAL}>
                  {attentionReasonLabel(t, each)}
                </Badge>
              ))}
            </span>
          ),
        },
        {
          header: t("label-student"),
          cell: (row) => (
            <span className={stackedCellCss}>
              <span>
                {row.first_name} {row.last_name}
              </span>
              <span className={noteCss}>{row.email}</span>
            </span>
          ),
        },
        {
          header: t("label-student-number"),
          cell: (row) => row.student_number ?? ABSENT,
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
          header: t("label-error-code"),
          cell: (row) => (row.error_code ? <code>{row.error_code}</code> : ABSENT),
        },
        {
          header: t("label-credit-registration-attempts"),
          cell: (row) => row.attempt_count,
        },
        {
          header: t("label-credit-registration-time-in-state"),
          cell: (row) => <RelativeTime at={row.state_entered_at} />,
        },
        {
          header: t("credit-registration-admin-column-next-attempt"),
          cell: (row) => <RelativeTime at={row.next_attempt_at} />,
        },
      ]}
    />
  )
}

const AttentionSection: React.FC<{ attention: CreditRegistrationAttentionItems }> = ({
  attention,
}) => {
  const { t } = useTranslation()
  const thresholdsQuery = useCreditRegistrationThresholds()
  const { control, watch, reset } = useForm<SelectionFields>({ defaultValues: { selected: {} } })
  const selected = watch("selected")
  const selectedIds = Object.entries(selected ?? {})
    .filter(([, checked]) => checked)
    .map(([id]) => id)
  const thresholds = thresholdsQuery.data

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-attention")}</h2>
      <div className={tilesCss}>
        <StatTile
          label={t("label-credit-registration-needs-attention")}
          value={attention.total_count}
          {...includeIf(attention.total_count > 0, { tone: TONE.ALERT })}
        />
      </div>
      {attention.total_count >= attention.max_items && (
        <p className={noteCss}>
          {t("credit-registration-admin-attention-capped", { max: attention.max_items })}
        </p>
      )}
      {thresholds && (
        <p className={noteCss}>
          {t("credit-registration-admin-stuck-thresholds", {
            readyToSubmit: thresholds.stuck_ready_to_submit_secs,
            submitting: thresholds.stuck_submitting_secs,
            awaitingVerification: thresholds.stuck_awaiting_verification_secs,
            failedRetryable: thresholds.stuck_failed_retryable_secs,
          })}
        </p>
      )}
      <div className={actionsCss}>
        <AdminBulkTransitionDialog
          selectedIds={selectedIds}
          onApplied={() => reset({ selected: {} })}
        />
        <AdminRequeueRetryableDialog />
      </div>
      {attention.total_count === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-nothing-needs-a-human")}</p>
      ) : (
        attention.counts_by_reason.map((group) => (
          <Disclosure
            key={group.reason}
            defaultExpanded={group.count > 0}
            title={`${attentionReasonLabel(t, group.reason)}${MIDDLE_DOT}${group.count}`}
          >
            <AttentionTable
              reason={group.reason}
              items={attention.items.filter((item) => item.reasons.includes(group.reason))}
              control={control}
            />
          </Disclosure>
        ))
      )}
    </section>
  )
}

/** Two halves on one tab because an incident is read as one: what is breaking, and who must act. */
const ErrorsPage: React.FC = () => {
  const { control, watch } = useForm<WindowFields>({
    defaultValues: { window_secs: String(DAY_SECS) },
  })
  const windowSecs = Number(watch("window_secs"))
  const attentionQuery = useCreditRegistrationAttentionItems()

  return (
    <div className={sectionsCss}>
      <div className={controlsCss}>
        <WindowSecsSelect control={control} includeMonth />
      </div>
      <VerdictSection windowSecs={windowSecs} />
      <QueryResult query={attentionQuery}>
        {(attention) => <AttentionSection attention={attention} />}
      </QueryResult>
    </div>
  )
}

export default ErrorsPage
