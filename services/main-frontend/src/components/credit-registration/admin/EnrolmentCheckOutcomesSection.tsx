"use client"

import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import AbsentValue from "@/components/credit-registration/AbsentValue"
import type { EnrolmentCheckFindings } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import { ALIGN_END, CREDIT_REGISTRATION_NS, DENSITY_COMPACT, TABLE_STACK } from "../constants"
import { formatIntervalInWords } from "../durationWords"
import { headingCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import {
  enrolmentCheckGroupLabel,
  enrolmentCheckSourceLabel,
  enrolmentCheckStepLabel,
} from "./adminCreditRegistrationCopy"

/** What the checks found, by check schedule, check and what triggered them. */
const EnrolmentCheckOutcomesSection: React.FC<{ rows: EnrolmentCheckFindings[] }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()

  return (
    <section className={sectionCardCss} aria-labelledby={headingId}>
      <div className={sectionCardHeaderCss}>
        <h2 id={headingId} className={headingCss}>
          {t("credit-registration-heading-enrolment-check-outcomes")}
        </h2>
      </div>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.enrolment_check_group}-${row.enrolment_check_step}-${row.source}`}
        rows={rows}
        emptyState={t("credit-registration-admin-no-enrolment-check-findings")}
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
            header: t("credit-registration-admin-column-source"),
            minWidth: "9rem",
            cell: (row) => enrolmentCheckSourceLabel(t, row.source),
          },
          {
            header: t("credit-registration-admin-column-checks"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.check_count,
          },
          {
            header: t("credit-registration-admin-column-found"),
            align: ALIGN_END,
            minWidth: "5rem",
            nowrap: true,
            cell: (row) => row.found_count,
          },
          {
            header: t("credit-registration-admin-column-p50-detection"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) =>
              row.p50_detection_secs === null || row.p50_detection_secs === undefined ? (
                <AbsentValue />
              ) : (
                formatIntervalInWords(t, row.p50_detection_secs)
              ),
          },
          {
            header: t("credit-registration-admin-column-p95-detection"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) =>
              row.p95_detection_secs === null || row.p95_detection_secs === undefined ? (
                <AbsentValue />
              ) : (
                formatIntervalInWords(t, row.p95_detection_secs)
              ),
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckOutcomesSection
