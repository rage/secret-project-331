"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { adminMaterializeCreditRegistrations } from "@/generated/api/sdk.generated"
import type { CreditRegistrationReconciliation } from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure, Link, RelativeTime, Table } from "@/shared-module/components"

import { DENSITY_COMPACT, LINK_QUIET, MIDDLE_DOT, TIME_COMPACT, TONE } from "../constants"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
  spacedRowCss,
  stackedCellCss,
  subsectionCss,
} from "../styles"
import { useInvalidateReconciliation } from "./adminCreditRegistrationHooks"
import AdminStateBadge from "./AdminStateBadge"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

interface Props {
  reconciliation: CreditRegistrationReconciliation
}

const StudentCell: React.FC<{
  row: { first_name?: string | null; last_name?: string | null; email?: string | null }
  /** Links the name to the registration; detectors without one row per registration omit it. */
  href?: string
}> = ({ row, href }) => (
  <span className={stackedCellCss}>
    {href ? (
      <Link href={href} appearance={LINK_QUIET} prefetch={false}>
        {formatUserName(row)}
      </Link>
    ) : (
      <span>{formatUserName(row)}</span>
    )}
    <span className={noteCss}>{row.email}</span>
  </span>
)

/** A detector that found something: open on arrival, because its findings are the section's content. */
const Detector: React.FC<{
  heading: string
  count: number
  explanation: string
  children: React.ReactNode
}> = ({ heading, count, explanation, children }) => (
  <Disclosure title={`${heading}${MIDDLE_DOT}${count}`} variant="plain" defaultExpanded>
    <div className={subsectionCss}>
      <p className={cx(noteCss, proseCss)}>{explanation}</p>
      {children}
    </div>
  </Disclosure>
)

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
 * The silent failures: everything here is defined by an absence, which no other view can see.
 *
 * Only the detectors that are absences. A reversed attainment and an uncertain submission are live
 * ledger rows the work queue already lists, so repeating them here would put the same registrations
 * on the page twice.
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
              minWidth: "12rem",
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
                  <Badge tone={TONE.INFO} size="compact">
                    {t("credit-registration-admin-missing-enrolment")}
                  </Badge>
                ) : (
                  <Badge tone={TONE.NEUTRAL} size="compact">
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
              minWidth: "12rem",
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
              minWidth: "12rem",
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
                    <Badge tone={TONE.INFO} size="compact">
                      {t("credit-registration-admin-mirror-missing")}
                    </Badge>
                  )}
                  {row.registered_by_a_registrar && (
                    <Badge tone={TONE.INFO} size="compact">
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

  const found = detectors.filter((detector) => detector.count > 0)
  const foundNothing = detectors.filter((detector) => detector.count === 0)
  const findingCount = found.reduce((sum, detector) => sum + detector.count, 0)

  return (
    <section className={sectionCss}>
      <div className={spacedRowCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-reconciliation")}</h2>
        {/* Beside the heading, not inside the detector: materialise is the action for this whole
            section and stays worth reaching when that detector found nothing. */}
        <MaterializeButton />
      </div>
      <div className={sectionHeaderCss}>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-findings-count", { count: findingCount })}{" "}
          {t("credit-registration-admin-detector-cap", {
            max: reconciliation.max_rows_per_detector,
          })}
        </p>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-reconciliation-in-queue-note")}
        </p>
      </div>
      {found.map((detector) => (
        <Detector
          key={detector.key}
          heading={detector.key}
          count={detector.count}
          explanation={detector.explanation}
        >
          {detector.body}
        </Detector>
      ))}
      {foundNothing.length > 0 && (
        <p className={noteCss}>
          {t("credit-registration-admin-detectors-found-nothing", {
            detectors: foundNothing.map((detector) => detector.key).join(MIDDLE_DOT),
          })}
        </p>
      )}
    </section>
  )
}

export default ReconciliationSection
