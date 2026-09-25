"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { EnrolmentCheckLateness } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import { ALIGN_END, CREDIT_REGISTRATION_NS, DENSITY_COMPACT, TABLE_STACK } from "../constants"
import { headingCss, noteCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { enrolmentCheckGroupLabel } from "./adminCreditRegistrationCopy"
import { formatIntervalSecs } from "./phaseStatus"

/** How late the schedule's own checks ran against their ladder time, by group and step. */
const EnrolmentCheckLatenessSection: React.FC<{
  rows: EnrolmentCheckLateness[]
  veryLateAfterSecs: number
}> = ({ rows, veryLateAfterSecs }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-enrolment-check-lateness")}</h2>
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-enrolment-checks-very-late-note", {
          threshold: formatIntervalSecs(veryLateAfterSecs, t),
        })}
      </p>
      <Table
        caption={t("credit-registration-heading-enrolment-check-lateness")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.enrolment_check_group}-${row.enrolment_check_step}`}
        rows={rows}
        emptyState={t("credit-registration-admin-no-enrolment-checks-in-window")}
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
            cell: (row) => row.enrolment_check_step,
          },
          {
            header: t("credit-registration-admin-column-checks"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.check_count,
          },
          {
            header: t("credit-registration-admin-column-p50-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatIntervalSecs(row.p50_late_secs, t),
          },
          {
            header: t("credit-registration-admin-column-p95-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatIntervalSecs(row.p95_late_secs, t),
          },
          {
            header: t("credit-registration-admin-column-max-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatIntervalSecs(row.max_late_secs, t),
          },
          {
            header: t("credit-registration-admin-column-very-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => row.very_late_count,
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckLatenessSection
