"use client"

import React, { useEffect, useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
  ListCreditRegistrationsForAdminData,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Button, QueryResult, Select, Table } from "@/shared-module/components"

import {
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  QUIET_REFRESH,
  TABLE_STACK,
} from "../constants"
import {
  codeValueCss,
  controlCss,
  controlsCss,
  noteCss,
  rowCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
  toolbarCss,
} from "../styles"
import AdminBulkTransitionDialog from "./AdminBulkTransitionDialog"
import { adminLedgerStateLabel, ERROR_CODES } from "./adminCreditRegistrationCopy"
import {
  useAdminCreditRegistrations,
  useCreditRegistrationCourseStats,
} from "./adminCreditRegistrationHooks"
import AdminRequeueRetryableDialog from "./AdminRequeueRetryableDialog"
import AdminStateLabel from "./AdminStateLabel"
import { ALL_STATES } from "./queueBuckets"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"

type ListQuery = NonNullable<ListCreditRegistrationsForAdminData["query"]>

/** The bulk endpoint's own cap on one call, so every listed row can be picked at once. */
const MAX_PICKABLE_ROWS = 500

const ANY = ""

interface PickerFields {
  state: CreditRegistrationState | typeof ANY
  errorCode: CreditRegistrationErrorCode | typeof ANY
  courseId: string
}

/**
 * Moves many registrations at once: "Send everything again", and a row picker by ledger state,
 * error code and course feeding the bulk transition dialog.
 *
 * `prefilledErrorCode` replaces the error code filter whenever it changes, so "Select these rows" on
 * the error code table lands here already narrowed.
 */
const BulkChangesSection: React.FC<{ prefilledErrorCode: CreditRegistrationErrorCode | null }> = ({
  prefilledErrorCode,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()
  const courseStatsQuery = useCreditRegistrationCourseStats()
  const { control, watch, setValue } = useForm<PickerFields>({
    defaultValues: { state: ANY, errorCode: prefilledErrorCode ?? ANY, courseId: ANY },
  })
  const state = watch("state")
  const errorCode = watch("errorCode")
  const courseId = watch("courseId")

  useEffect(() => {
    if (prefilledErrorCode) {
      setValue("errorCode", prefilledErrorCode)
    }
  }, [prefilledErrorCode, setValue])

  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const clearSelection = () => setSelectedKeys(new Set())
  useEffect(() => setSelectedKeys(new Set()), [state, errorCode, courseId])

  const hasFilter = state !== ANY || errorCode !== ANY || courseId !== ANY
  const query: ListQuery = {
    page: 1,
    limit: MAX_PICKABLE_ROWS,
    include_not_started: true,
    ...(state !== ANY ? { state: [state] } : {}),
    ...(errorCode !== ANY ? { error_code: [errorCode] } : {}),
    ...(courseId !== ANY ? { course_id: courseId } : {}),
  }
  const rowsQuery = useAdminCreditRegistrations(query, {
    // A list that reshuffles while rows are being picked would change what the dialog acts on.
    paused: selectedKeys.size > 0,
    enabled: hasFilter,
  })
  const rows = useMemo(
    () => (hasFilter ? (rowsQuery.data?.data ?? []) : []),
    [hasFilter, rowsQuery.data],
  )
  const selectedRows = rows
    .filter((row) => selectedKeys.has(row.id))
    .map((row) => ({
      credit_registration_id: row.id,
      state: row.state,
      hand_actions: row.hand_actions,
    }))

  const courseOptions = useMemo(() => {
    const byCourseId = new Map<string, string>()
    for (const courseModule of courseStatsQuery.data?.modules ?? []) {
      byCourseId.set(courseModule.course_id, courseModule.course_name)
    }
    return Array.from(byCourseId, ([value, label]) => ({ value, label }))
  }, [courseStatsQuery.data?.modules])

  return (
    <div className={subsectionCss}>
      <div className={rowCss}>
        <AdminRequeueRetryableDialog />
      </div>
      <h3 id={headingId} className={subheadingCss}>
        {t("credit-registration-heading-pick-rows")}
      </h3>
      <div className={controlsCss}>
        <div className={controlCss}>
          <Select
            name="state"
            control={control}
            label={t("label-state")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-state") },
              ...ALL_STATES.map((one) => ({ value: one, label: adminLedgerStateLabel(t, one) })),
            ]}
          />
        </div>
        <div className={controlCss}>
          <Select
            name="errorCode"
            control={control}
            label={t("label-error-code")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-error-code") },
              ...ERROR_CODES.map((code) => ({ value: code, label: code })),
            ]}
            searchEnabled
          />
        </div>
        <div className={controlCss}>
          <Select
            name="courseId"
            control={control}
            label={t("label-course")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-course") },
              ...courseOptions,
            ]}
            searchEnabled
          />
        </div>
      </div>
      {!hasFilter ? (
        <p className={noteCss}>{t("credit-registration-admin-pick-rows-note")}</p>
      ) : (
        <QueryResult query={rowsQuery} refreshIndicator={QUIET_REFRESH}>
          {(page) => (
            <>
              {page.total_count > rows.length && (
                <p className={noteCss}>
                  {t("credit-registration-admin-pick-rows-capped", {
                    shown: rows.length,
                    total: page.total_count,
                  })}
                </p>
              )}
              {selectedRows.length > 0 && (
                <div className={toolbarCss}>
                  <div className={rowCss}>
                    <span>
                      {t("credit-registration-admin-selected-count", {
                        count: selectedRows.length,
                      })}
                    </span>
                    <AdminBulkTransitionDialog
                      selectedRows={selectedRows}
                      onApplied={clearSelection}
                    />
                    <Button variant={BUTTON_TERTIARY} size="medium" onClick={clearSelection}>
                      {t("credit-registration-admin-clear-selection")}
                    </Button>
                  </div>
                </div>
              )}
              <Table
                labelledBy={headingId}
                density={DENSITY_COMPACT}
                responsive={TABLE_STACK}
                rowKey={(row) => row.id}
                rows={rows}
                emptyState={t("credit-registration-admin-no-matching-rows")}
                selection={{
                  selectedKeys,
                  onChange: setSelectedKeys,
                  selectAllLabel: t("credit-registration-admin-select-every-row"),
                  rowLabel: (row) =>
                    t("credit-registration-admin-select-registration", {
                      student: formatUserName(row),
                    }),
                }}
                columns={[
                  {
                    header: t("label-student"),
                    grow: 1,
                    minWidth: STUDENT_COLUMN_MIN_WIDTH,
                    cell: (row) => (
                      <StudentCell row={row} href={creditRegistrationItemRoute(row.id)} />
                    ),
                  },
                  {
                    header: t("label-course"),
                    grow: 1,
                    minWidth: "11rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>{row.course_name}</span>
                        <span className={noteCss}>{row.course_module_name}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-state"),
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <AdminStateLabel state={row.state} />
                        {row.error_code && <code className={codeValueCss}>{row.error_code}</code>}
                      </span>
                    ),
                  },
                  {
                    header: t("label-credit-registration-time-in-state"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => <ZonedTimestamp at={row.state_changed_at} />,
                  },
                ]}
              />
            </>
          )}
        </QueryResult>
      )}
    </div>
  )
}

export default BulkChangesSection
