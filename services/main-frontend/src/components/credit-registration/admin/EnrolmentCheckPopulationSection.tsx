"use client"

import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import type { EnrolmentCheckPopulation } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import { ALIGN_END, CREDIT_REGISTRATION_NS, DENSITY_COMPACT, TABLE_STACK } from "../constants"
import { headingCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { enrolmentCheckGroupLabel, enrolmentCheckStepLabel } from "./adminCreditRegistrationCopy"

/** How many registrations are on a check schedule, by schedule and check. */
const EnrolmentCheckPopulationSection: React.FC<{ rows: EnrolmentCheckPopulation[] }> = ({
  rows,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-enrolment-check-population")}
        </h2>
      </div>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.enrolment_check_group}-${row.enrolment_check_step}`}
        rows={rows}
        emptyState={t("credit-registration-admin-no-enrolment-check-population")}
        columns={[
          {
            header: t("credit-registration-admin-column-check-schedule"),
            minWidth: "10rem",
            cell: (row) => enrolmentCheckGroupLabel(t, row.enrolment_check_group),
          },
          {
            header: t("credit-registration-admin-column-check"),
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => enrolmentCheckStepLabel(t, row.enrolment_check_step),
          },
          {
            header: t("credit-registration-admin-column-rows"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.row_count,
          },
          {
            header: t("credit-registration-admin-column-never-checked"),
            align: ALIGN_END,
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => (row.never_checked_count === 0 ? null : row.never_checked_count),
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckPopulationSection
