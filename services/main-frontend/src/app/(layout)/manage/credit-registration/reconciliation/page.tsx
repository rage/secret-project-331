"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  useCreditRegistrationReconciliation,
  useInvalidateReconciliation,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import { useReasonConfirmAction } from "@/components/credit-registration/admin/useReasonConfirmAction"
import { TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  stackedCellCss,
  tilesCss,
} from "@/components/credit-registration/styles"
import { adminMaterializeCreditRegistrations } from "@/generated/api/sdk.generated"
import type {
  CreditRegistrationReconciliation,
  ReconciliationRegistration,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Badge, QueryResult, StatTile, Table, type TableColumn } from "@/shared-module/components"

const badgesCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`

const studentName = (row: { first_name?: string | null; last_name?: string | null }): string =>
  [row.first_name, row.last_name].filter(Boolean).join(" ")

const StudentCell: React.FC<{
  row: { first_name?: string | null; last_name?: string | null; email?: string | null }
}> = ({ row }) => (
  <span className={stackedCellCss}>
    <span>{studentName(row)}</span>
    <span className={noteCss}>{row.email}</span>
  </span>
)

/** Every registration detector shares these columns; only the copy around them differs. */
const registrationColumns = (t: TFunction): TableColumn<ReconciliationRegistration>[] => [
  {
    header: t("label-state"),
    cell: (row) => (
      <Link href={creditRegistrationItemRoute(row.credit_registration_id)} prefetch={false}>
        <AdminStateBadge state={row.state} />
      </Link>
    ),
  },
  {
    header: t("label-student"),
    cell: (row) => <StudentCell row={row} />,
  },
  { header: t("label-student-number"), cell: (row) => row.student_number ?? ABSENT },
  {
    header: t("label-course"),
    cell: (row) => (
      <span className={stackedCellCss}>
        <span>{row.course_name}</span>
        <span className={noteCss}>{row.uh_course_code}</span>
      </span>
    ),
  },
  {
    header: t("credit-registration-admin-column-submitted-attainment"),
    cell: (row) =>
      row.submitted_attainment_id ? <code>{row.submitted_attainment_id}</code> : ABSENT,
  },
  {
    header: t("credit-registration-admin-column-submitted-at"),
    cell: (row) => <RelativeTime at={row.submitted_at} />,
  },
  {
    header: t("credit-registration-admin-column-registered-at"),
    cell: (row) => <RelativeTime at={row.registered_at} />,
  },
  {
    header: t("label-credit-registration-time-in-state"),
    cell: (row) => <RelativeTime at={row.state_entered_at} />,
  },
]

const DetectorSection: React.FC<{
  heading: string
  explanation: string
  emptyText: string
  rows: ReconciliationRegistration[]
  children?: React.ReactNode
}> = ({ heading, explanation, emptyText, rows, children }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{heading}</h2>
      <p className={noteCss}>{explanation}</p>
      {children}
      {rows.length === 0 ? (
        <p className={noteCss}>{emptyText}</p>
      ) : (
        <Table
          caption={heading}
          rowKey={(row) => row.credit_registration_id}
          rows={rows}
          columns={registrationColumns(t)}
        />
      )}
    </section>
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
    <div>
      {button}
      {dialog}
    </div>
  )
}

const NeverEnteredSection: React.FC<{ reconciliation: CreditRegistrationReconciliation }> = ({
  reconciliation,
}) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-never-entered")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-never-entered-explanation")}</p>
      <MaterializeButton />
      {reconciliation.never_entered.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-never-entered")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-never-entered")}
          rowKey={(row) => row.course_module_completion_id}
          rows={reconciliation.never_entered}
          columns={[
            {
              header: t("label-student"),
              cell: (row) => <StudentCell row={row} />,
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
              header: t("credit-registration-admin-column-completed"),
              cell: (row) => <RelativeTime at={row.completion_date} />,
            },
            {
              header: t("credit-registration-admin-column-why-not-materialised"),
              cell: (row) =>
                row.missing_enrolment ? (
                  <Badge tone={TONE.WARNING}>
                    {t("credit-registration-admin-missing-enrolment")}
                  </Badge>
                ) : (
                  <Badge tone={TONE.NEUTRAL}>
                    {t("credit-registration-admin-materialise-would-take-it")}
                  </Badge>
                ),
            },
          ]}
        />
      )}
    </section>
  )
}

const LegacySection: React.FC<{ reconciliation: CreditRegistrationReconciliation }> = ({
  reconciliation,
}) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-legacy-divergence")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-legacy-divergence-explanation")}</p>
      {reconciliation.legacy_divergences.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-legacy-divergence")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-legacy-divergence")}
          rowKey={(row) => row.credit_registration_id}
          rows={reconciliation.legacy_divergences}
          columns={[
            {
              header: t("label-state"),
              cell: (row) => (
                <Link
                  href={creditRegistrationItemRoute(row.credit_registration_id)}
                  prefetch={false}
                >
                  <AdminStateBadge state={row.state} />
                </Link>
              ),
            },
            {
              header: t("label-student"),
              cell: (row) => <StudentCell row={row} />,
            },
            { header: t("label-course"), cell: (row) => row.course_name },
            {
              header: t("credit-registration-admin-column-divergence"),
              cell: (row) => (
                <span className={badgesCss}>
                  {row.mirror_missing && (
                    <Badge tone={TONE.WARNING}>
                      {t("credit-registration-admin-mirror-missing")}
                    </Badge>
                  )}
                  {row.registered_by_a_registrar && (
                    <Badge tone={TONE.WARNING}>
                      {t("credit-registration-admin-registered-by-a-registrar")}
                    </Badge>
                  )}
                </span>
              ),
            },
            {
              header: t("label-credit-registration-time-in-state"),
              cell: (row) => <RelativeTime at={row.state_entered_at} />,
            },
          ]}
        />
      )}
    </section>
  )
}

/** The silent failures: everything here is defined by an absence, which no other tab can see. */
const ReconciliationPage: React.FC = () => {
  const { t } = useTranslation()
  const reconciliationQuery = useCreditRegistrationReconciliation()

  return (
    <QueryResult query={reconciliationQuery}>
      {(reconciliation) => (
        <div className={sectionsCss}>
          <section className={sectionCss}>
            <h2 className={headingCss}>{t("credit-registration-heading-reconciliation")}</h2>
            <div className={tilesCss}>
              <StatTile
                label={t("credit-registration-admin-findings")}
                value={reconciliation.finding_count}
                {...includeIf(reconciliation.finding_count > 0, { tone: TONE.ALERT })}
              />
              <StatTile
                label={t("credit-registration-heading-never-entered")}
                value={reconciliation.never_entered_count}
              />
              <StatTile
                label={t("credit-registration-heading-outcome-uncertain")}
                value={reconciliation.outcome_uncertain_count}
              />
              <StatTile
                label={t("credit-registration-heading-several-attainments")}
                value={reconciliation.several_submitted_attainments_count}
              />
              <StatTile
                label={t("credit-registration-heading-misregistered")}
                value={reconciliation.misregistered_count}
              />
              <StatTile
                label={t("credit-registration-heading-legacy-divergence")}
                value={reconciliation.legacy_divergence_count}
              />
            </div>
            <p className={noteCss}>
              {t("credit-registration-admin-detector-cap", {
                max: reconciliation.max_rows_per_detector,
              })}
            </p>
          </section>
          <NeverEnteredSection reconciliation={reconciliation} />
          <DetectorSection
            heading={t("credit-registration-heading-outcome-uncertain")}
            explanation={t("credit-registration-admin-outcome-uncertain-explanation")}
            emptyText={t("credit-registration-admin-no-outcome-uncertain")}
            rows={reconciliation.outcome_uncertain}
          />
          <DetectorSection
            heading={t("credit-registration-heading-several-attainments")}
            explanation={t("credit-registration-admin-several-attainments-explanation")}
            emptyText={t("credit-registration-admin-no-several-attainments")}
            rows={reconciliation.several_submitted_attainments}
          />
          <DetectorSection
            heading={t("credit-registration-heading-misregistered")}
            explanation={t("credit-registration-admin-misregistered-explanation")}
            emptyText={t("credit-registration-admin-no-misregistered")}
            rows={reconciliation.misregistered}
          />
          <LegacySection reconciliation={reconciliation} />
          <DetectorSection
            heading={t("credit-registration-heading-consent-withdrawn")}
            explanation={t("credit-registration-admin-consent-withdrawn-explanation")}
            emptyText={t("credit-registration-admin-no-consent-withdrawn")}
            rows={reconciliation.outcome_unknown_consent_withdrawn}
          />
        </div>
      )}
    </QueryResult>
  )
}

export default ReconciliationPage
