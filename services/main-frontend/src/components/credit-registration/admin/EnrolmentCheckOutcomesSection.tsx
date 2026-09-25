"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { EnrolmentCheckFindings, EnrolmentCheckSource } from "@/generated/api/types.generated"
import { Table } from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  TABLE_STACK,
} from "../constants"
import { headingCss, sectionCardCss, sectionCardHeaderCss } from "../styles"
import { enrolmentCheckGroupLabel, enrolmentCheckSourceLabel } from "./adminCreditRegistrationCopy"
import { ENROLMENT_CHECK_GROUP_ORDER, byGroupThenStep } from "./enrolmentCheckOrder"
import { formatIntervalSecs } from "./phaseStatus"

const SOURCE_ORDER: readonly EnrolmentCheckSource[] = [
  "schedule",
  "student_request",
  "teacher_request",
  "admin_request",
  "roster_listing",
  "account_link",
]

const byGroupSourceThenStep = (a: EnrolmentCheckFindings, b: EnrolmentCheckFindings): number => {
  const groupOrder =
    ENROLMENT_CHECK_GROUP_ORDER.indexOf(a.enrolment_check_group) -
    ENROLMENT_CHECK_GROUP_ORDER.indexOf(b.enrolment_check_group)
  if (groupOrder !== 0) {
    return groupOrder
  }
  const sourceOrder = SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source)
  if (sourceOrder !== 0) {
    return sourceOrder
  }
  return byGroupThenStep<EnrolmentCheckFindings>((row) => row.enrolment_check_step)(a, b)
}

/** What the checks found, by group, step and what triggered them. */
const EnrolmentCheckOutcomesSection: React.FC<{ rows: EnrolmentCheckFindings[] }> = ({ rows }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const sorted = rows.toSorted(byGroupSourceThenStep)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-enrolment-check-outcomes")}</h2>
      </div>
      <Table
        caption={t("credit-registration-heading-enrolment-check-outcomes")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.enrolment_check_group}-${row.enrolment_check_step}-${row.source}`}
        rows={sorted}
        emptyState={t("credit-registration-admin-no-enrolment-check-findings")}
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
            header: t("credit-registration-admin-column-found-after-stop"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => row.found_after_stop_count,
          },
          {
            header: t("credit-registration-admin-column-p50-detection"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) =>
              row.p50_detection_secs === null || row.p50_detection_secs === undefined
                ? ABSENT
                : formatIntervalSecs(row.p50_detection_secs, t),
          },
          {
            header: t("credit-registration-admin-column-p95-detection"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: true,
            cell: (row) =>
              row.p95_detection_secs === null || row.p95_detection_secs === undefined
                ? ABSENT
                : formatIntervalSecs(row.p95_detection_secs, t),
          },
        ]}
      />
    </section>
  )
}

export default EnrolmentCheckOutcomesSection
