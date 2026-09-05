"use client"

import { cx } from "@emotion/css"
import type { TFunction } from "i18next"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { adminMaterializeCreditRegistrations } from "@/generated/api/sdk.generated"
import type {
  CreditRegistrationReconciliation,
  ReconciliationRegistration,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import type { TableColumn } from "@/shared-module/components"
import {
  Badge,
  Disclosure,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import { ABSENT, MIDDLE_DOT, TIME_IN_TITLE, TONE } from "../constants"
import {
  emptyStateCss,
  headingCss,
  monospaceCss,
  noteCss,
  rowCss,
  sectionCss,
  stackedCellCss,
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
      <Link href={href} prefetch={false}>
        {formatUserName(row)}
      </Link>
    ) : (
      <span>{formatUserName(row)}</span>
    )}
    <span className={noteCss}>{row.email}</span>
  </span>
)

/** Every registration detector shares these columns; only the copy around them differs. */
const registrationColumns = (t: TFunction): TableColumn<ReconciliationRegistration>[] => [
  {
    header: t("label-student"),
    cell: (row) => (
      <StudentCell row={row} href={creditRegistrationItemRoute(row.credit_registration_id)} />
    ),
  },
  {
    header: t("label-student-number"),
    cell: (row) => <span className={monospaceCss}>{row.student_number ?? ABSENT}</span>,
  },
  {
    header: t("label-course"),
    cell: (row) => (
      <span className={stackedCellCss}>
        <span>{row.course_name}</span>
        <span className={cx(noteCss, monospaceCss)}>{row.uh_course_code}</span>
      </span>
    ),
  },
  { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
  {
    header: t("credit-registration-admin-column-submitted-at"),
    cell: (row) => <RelativeTime at={row.submitted_at} absoluteTime={TIME_IN_TITLE} />,
  },
  {
    header: t("label-credit-registration-time-in-state"),
    cell: (row) => <RelativeTime at={row.state_entered_at} absoluteTime={TIME_IN_TITLE} />,
  },
]

const Detector: React.FC<{
  heading: string
  count: number
  explanation: string
  emptyText: string
  children: React.ReactNode
}> = ({ heading, count, explanation, emptyText, children }) => (
  <Disclosure title={`${heading}${MIDDLE_DOT}${count}`}>
    <p className={noteCss}>{explanation}</p>
    {count === 0 ? <p className={emptyStateCss}>{emptyText}</p> : children}
  </Disclosure>
)

const RegistrationDetector: React.FC<{
  heading: string
  explanation: string
  emptyText: string
  rows: ReconciliationRegistration[]
}> = ({ heading, explanation, emptyText, rows }) => {
  const { t } = useTranslation()
  return (
    <Detector heading={heading} count={rows.length} explanation={explanation} emptyText={emptyText}>
      <Table
        caption={heading}
        rowKey={(row) => row.credit_registration_id}
        rows={rows}
        columns={registrationColumns(t)}
      />
    </Detector>
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

/** The silent failures: everything here is defined by an absence, which no other region can see. */
const ReconciliationSection: React.FC<Props> = ({ reconciliation }) => {
  const { t } = useTranslation()

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-reconciliation")}</h2>
      <StatTileList ariaLabel={t("credit-registration-heading-reconciliation")}>
        <StatTile
          label={t("credit-registration-admin-findings")}
          value={reconciliation.finding_count}
          alertWhenNonZero
        />
      </StatTileList>
      <p className={noteCss}>
        {t("credit-registration-admin-detector-cap", { max: reconciliation.max_rows_per_detector })}
      </p>
      <Detector
        heading={t("credit-registration-heading-never-entered")}
        count={reconciliation.never_entered_count}
        explanation={t("credit-registration-admin-never-entered-explanation")}
        emptyText={t("credit-registration-admin-no-never-entered")}
      >
        <MaterializeButton />
        <Table
          caption={t("credit-registration-heading-never-entered")}
          rowKey={(row) => row.course_module_completion_id}
          rows={reconciliation.never_entered}
          columns={[
            { header: t("label-student"), cell: (row) => <StudentCell row={row} /> },
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
              header: t("credit-registration-admin-column-completed"),
              cell: (row) => <RelativeTime at={row.completion_date} absoluteTime={TIME_IN_TITLE} />,
            },
            {
              header: t("credit-registration-admin-column-why-not-materialised"),
              cell: (row) =>
                row.missing_enrolment ? (
                  <Badge tone={TONE.INFO}>{t("credit-registration-admin-missing-enrolment")}</Badge>
                ) : (
                  <Badge tone={TONE.NEUTRAL}>
                    {t("credit-registration-admin-materialise-would-take-it")}
                  </Badge>
                ),
            },
          ]}
        />
      </Detector>
      <RegistrationDetector
        heading={t("credit-registration-heading-outcome-uncertain")}
        explanation={t("credit-registration-admin-outcome-uncertain-explanation")}
        emptyText={t("credit-registration-admin-no-outcome-uncertain")}
        rows={reconciliation.outcome_uncertain}
      />
      <RegistrationDetector
        heading={t("credit-registration-heading-several-attainments")}
        explanation={t("credit-registration-admin-several-attainments-explanation")}
        emptyText={t("credit-registration-admin-no-several-attainments")}
        rows={reconciliation.several_submitted_attainments}
      />
      <RegistrationDetector
        heading={t("credit-registration-heading-misregistered")}
        explanation={t("credit-registration-admin-misregistered-explanation")}
        emptyText={t("credit-registration-admin-no-misregistered")}
        rows={reconciliation.misregistered}
      />
      <Detector
        heading={t("credit-registration-heading-legacy-divergence")}
        count={reconciliation.legacy_divergence_count}
        explanation={t("credit-registration-admin-legacy-divergence-explanation")}
        emptyText={t("credit-registration-admin-no-legacy-divergence")}
      >
        <Table
          caption={t("credit-registration-heading-legacy-divergence")}
          rowKey={(row) => row.credit_registration_id}
          rows={reconciliation.legacy_divergences}
          columns={[
            {
              header: t("label-student"),
              cell: (row) => (
                <StudentCell
                  row={row}
                  href={creditRegistrationItemRoute(row.credit_registration_id)}
                />
              ),
            },
            { header: t("label-course"), cell: (row) => row.course_name },
            { header: t("label-state"), cell: (row) => <AdminStateBadge state={row.state} /> },
            {
              header: t("credit-registration-admin-column-divergence"),
              cell: (row) => (
                <span className={rowCss}>
                  {row.mirror_missing && (
                    <Badge tone={TONE.INFO}>{t("credit-registration-admin-mirror-missing")}</Badge>
                  )}
                  {row.registered_by_a_registrar && (
                    <Badge tone={TONE.INFO}>
                      {t("credit-registration-admin-registered-by-a-registrar")}
                    </Badge>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Detector>
    </section>
  )
}

export default ReconciliationSection
