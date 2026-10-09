"use client"

import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import type { EnrolmentCheckLateness } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import { ALIGN_END, CREDIT_REGISTRATION_NS, DENSITY_COMPACT, TABLE_STACK } from "../constants"
import { formatIntervalInWords } from "../durationWords"
import { headingCss, noteCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { enrolmentCheckGroupLabel, enrolmentCheckStepLabel } from "./adminCreditRegistrationCopy"

/** How late the scheduled checks ran against their due time, by check schedule and check. */
const EnrolmentCheckLatenessSection: React.FC<{
  rows: EnrolmentCheckLateness[]
  veryLateAfterSecs: number
}> = ({ rows, veryLateAfterSecs }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-enrolment-check-lateness")}
        </h2>
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-enrolment-checks-very-late-note", {
          threshold: formatIntervalInWords(t, veryLateAfterSecs),
        })}
      </p>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.enrolment_check_group}-${row.enrolment_check_step}`}
        rows={rows}
        emptyState={t("credit-registration-admin-no-enrolment-checks-in-window")}
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
            cell: (row) => formatIntervalInWords(t, row.p50_late_secs),
          },
          {
            header: t("credit-registration-admin-column-p95-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatIntervalInWords(t, row.p95_late_secs),
          },
          {
            header: t("credit-registration-admin-column-max-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => formatIntervalInWords(t, row.max_late_secs),
          },
          {
            header: t("credit-registration-admin-column-very-late"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: true,
            cell: (row) => (row.very_late_count === 0 ? null : row.very_late_count),
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckLatenessSection
