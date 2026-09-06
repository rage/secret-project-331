"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { adminMaterializeCreditRegistrations } from "@/generated/api/sdk.generated"
import type { CreditRegistrationReconciliation } from "@/generated/api/types.generated"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure, RelativeTime, Table } from "@/shared-module/components"

import { BADGE_COMPACT, DENSITY_COMPACT, PLAIN_DISCLOSURE, TIME_COMPACT, TONE } from "../constants"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  stackedCellCss,
  subsectionCss,
} from "../styles"
import { useInvalidateReconciliation } from "./adminCreditRegistrationHooks"
import AdminStateBadge from "./AdminStateBadge"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

interface Props {
  reconciliation: CreditRegistrationReconciliation
}

/**
 * One check and what it found. A check that found nothing is one line with a badge: it still has
 * to say it ran, and it has nothing to expand.
 */
const Check: React.FC<{
  heading: string
  count: number
  explanation: string
  /** How many rows the endpoint will list; a check at the cap has more than it shows. */
  maxRows: number
  children: React.ReactNode
}> = ({ heading, count, explanation, maxRows, children }) => {
  const { t } = useTranslation()
  if (count === 0) {
    return (
      <p className={rowCss}>
        <span>{heading}</span>
        <Badge tone={TONE.SUCCESS} size={BADGE_COMPACT}>
          {t("credit-registration-admin-check-none-found")}
        </Badge>
      </p>
    )
  }
  return (
    <Disclosure
      title={heading}
      summary={
        <Badge tone={TONE.WARNING} size={BADGE_COMPACT}>
          {t("credit-registration-admin-check-found", { count })}
        </Badge>
      }
      variant={PLAIN_DISCLOSURE}
      defaultExpanded
    >
      <div className={subsectionCss}>
        <p className={cx(noteCss, proseCss)}>{explanation}</p>
        {count >= maxRows && (
          <p className={cx(noteCss, proseCss)}>
            {t("credit-registration-admin-detector-cap", { max: maxRows })}
          </p>
        )}
        {children}
      </div>
    </Disclosure>
  )
}

const MaterializeButton: React.FC = () => {
  const { t } = useTranslation()
  const invalidateReconciliation = useInvalidateReconciliation()
  const { button, dialog } = useReasonConfirmAction({
    mutationFn: (fields) =>
      adminMaterializeCreditRegistrations({ body: { reason: fields.reason } }),
    invalidate: () => void invalidateReconciliation(),
    buttonLabel: t("button-text-credit-registration-materialize"),
    dialogTitle: t("button-text-credit-registration-materialize"),
    dialogMessage: t("credit-registration-admin-materialize-note"),
    // oxlint-disable-next-line i18next/no-literal-string
    buttonVariant: "secondary",
  })
  return (
    <div className={rowCss}>
      {button}
      {dialog}
    </div>
  )
}

/**
 * The checks that read Sisu and our ledger against each other, each one named and saying what it
 * found. Only checks that are absences: a reversed attainment or uncertain submission is a live
 * ledger row the work queue already lists, so repeating it here would put the same registration on
 * two pages.
 */
const ReconciliationSection: React.FC<Props> = ({ reconciliation }) => {
  const { t } = useTranslation()

  const detectors = [
    {
      key: t("credit-registration-heading-never-entered"),
      count: reconciliation.never_entered_count,
      explanation: t("credit-registration-admin-never-entered-explanation"),
      body: (
        <Table
          caption={t("credit-registration-heading-never-entered")}
          density={DENSITY_COMPACT}
          rowKey={(row) => row.course_module_completion_id}
          rows={reconciliation.never_entered}
          columns={[
            {
              header: t("label-student"),
              grow: true,
              minWidth: STUDENT_COLUMN_MIN_WIDTH,
              cell: (row) => <StudentCell row={row} />,
            },
            {
              header: t("label-course"),
              minWidth: "11rem",
              cell: (row) => (
                <span className={stackedCellCss}>
                  <span>{row.course_name}</span>
                  <span className={noteCss}>{row.course_module_name}</span>
                </span>
              ),
            },
            {
              header: t("credit-registration-admin-column-completed"),
              minWidth: "8rem",
              nowrap: true,
              cell: (row) => <RelativeTime at={row.completion_date} absoluteTime={TIME_COMPACT} />,
            },
            {
              header: t("credit-registration-admin-column-why-not-materialised"),
              minWidth: "12rem",
              cell: (row) =>
                row.missing_enrolment ? (
                  <Badge tone={TONE.INFO} size={BADGE_COMPACT}>
                    {t("credit-registration-admin-missing-enrolment")}
                  </Badge>
                ) : (
                  <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
                    {t("credit-registration-admin-materialise-would-take-it")}
                  </Badge>
                ),
            },
          ]}
        />
      ),
    },
    {
      key: t("credit-registration-heading-several-attainments"),
      count: reconciliation.several_submitted_attainments_count,
      explanation: t("credit-registration-admin-several-attainments-explanation"),
      body: (
        <Table
          caption={t("credit-registration-heading-several-attainments")}
          density={DENSITY_COMPACT}
          rowKey={(row) => row.credit_registration_id}
          rows={reconciliation.several_submitted_attainments}
          columns={[
            {
              header: t("label-student"),
              grow: true,
              minWidth: STUDENT_COLUMN_MIN_WIDTH,
              cell: (row) => (
                <StudentCell
                  row={row}
                  href={creditRegistrationItemRoute(row.credit_registration_id)}
                />
              ),
            },
            {
              header: t("label-student-number"),
              minWidth: "7rem",
              nowrap: true,
              cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
            },
            {
              header: t("label-course"),
              minWidth: "11rem",
              cell: (row) => (
                <span className={stackedCellCss}>
                  <span>{row.course_name}</span>
                  <span className={cx(noteCss, monospaceCss)}>{row.uh_course_code}</span>
                </span>
              ),
            },
            {
              header: t("label-state"),
              minWidth: "10rem",
              cell: (row) => <AdminStateBadge state={row.state} />,
            },
            {
              header: t("credit-registration-admin-column-submitted-at"),
              minWidth: "8rem",
              nowrap: true,
              cell: (row) => <RelativeTime at={row.submitted_at} absoluteTime={TIME_COMPACT} />,
            },
          ]}
        />
      ),
    },
    {
      key: t("credit-registration-heading-legacy-divergence"),
      count: reconciliation.legacy_divergence_count,
      explanation: t("credit-registration-admin-legacy-divergence-explanation"),
      body: (
        <Table
          caption={t("credit-registration-heading-legacy-divergence")}
          density={DENSITY_COMPACT}
          rowKey={(row) => row.credit_registration_id}
          rows={reconciliation.legacy_divergences}
          columns={[
            {
              header: t("label-student"),
              grow: true,
              minWidth: STUDENT_COLUMN_MIN_WIDTH,
              cell: (row) => (
                <StudentCell
                  row={row}
                  href={creditRegistrationItemRoute(row.credit_registration_id)}
                />
              ),
            },
            { header: t("label-course"), minWidth: "11rem", cell: (row) => row.course_name },
            {
              header: t("label-state"),
              minWidth: "10rem",
              cell: (row) => <AdminStateBadge state={row.state} />,
            },
            {
              header: t("credit-registration-admin-column-divergence"),
              minWidth: "14rem",
              cell: (row) => (
                <span className={rowCss}>
                  {row.mirror_missing && (
                    <Badge tone={TONE.INFO} size={BADGE_COMPACT}>
                      {t("credit-registration-admin-mirror-missing")}
                    </Badge>
                  )}
                  {row.registered_by_a_registrar && (
                    <Badge tone={TONE.INFO} size={BADGE_COMPACT}>
                      {t("credit-registration-admin-registered-by-a-registrar")}
                    </Badge>
                  )}
                </span>
              ),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-reconciliation")}</h2>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-reconciliation-in-queue-note")}
      </p>
      {detectors
        .toSorted((a, b) => b.count - a.count)
        .map((detector) => (
          <Check
            key={detector.key}
            heading={detector.key}
            count={detector.count}
            explanation={detector.explanation}
            maxRows={reconciliation.max_rows_per_detector}
          >
            {detector.body}
          </Check>
        ))}
      {/* After the checks, not beside the heading: it stays the section's action regardless of
          what the checks found, but a phone must not read it before it reads why it exists. */}
      <MaterializeButton />
    </section>
  )
}

export default ReconciliationSection
