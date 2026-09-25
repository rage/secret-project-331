"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { EnrolmentCheckPopulation } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  TABLE_STACK,
} from "../constants"
import { headingCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { enrolmentCheckGroupLabel } from "./adminCreditRegistrationCopy"
import { byGroupThenStep } from "./enrolmentCheckOrder"

/** How many rows are waiting for an enrolment, by group, step and whether their ladder ran out. */
const EnrolmentCheckPopulationSection: React.FC<{ rows: EnrolmentCheckPopulation[] }> = ({
  rows,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const sorted = rows.toSorted(byGroupThenStep((row) => row.enrolment_check_step))

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-enrolment-check-population")}
        </h2>
      </div>
      <Table
        caption={t("credit-registration-heading-enrolment-check-population")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) =>
          `${row.enrolment_check_group}-${row.enrolment_check_step}-${row.is_stopped}`
        }
        rows={sorted}
        emptyState={t("credit-registration-admin-no-enrolment-check-population")}
        columns={[
          {
            header: t("credit-registration-admin-column-group"),
            minWidth: "10rem",
            cell: (row) => enrolmentCheckGroupLabel(t, row.enrolment_check_group),
          },
          {
            header: t("credit-registration-admin-column-step"),
            align: ALIGN_END,
            minWidth: "4rem",
            nowrap: true,
            cell: (row) => row.enrolment_check_step ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-column-stopped"),
            minWidth: "6rem",
            cell: (row) => (row.is_stopped ? t("yes") : t("no")),
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
            cell: (row) => row.never_checked_count,
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckPopulationSection
