"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { SuotarEndpoint } from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  Badge,
  QueryResult,
  RelativeTime,
  RELATIVE_TIME_ABSENT_LABEL,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"

import { ALIGN_END, QUIET_REFRESH, TIME_IN_TITLE, TONE } from "../constants"
import { controlCss, controlsCss, headingCss, noteCss, sectionCss } from "../styles"
import {
  useSuotarApiCalls,
  useSuotarHealth,
  useSuotarWorkerNames,
} from "./adminCreditRegistrationHooks"
import SuotarApiCallDetail from "./SuotarApiCallDetail"
import type { FilterFieldDescriptor } from "./useFilteredAdminQuery"
import { selectFilterField, useFilteredAdminQuery } from "./useFilteredAdminQuery"
import { DAY_SECS, useWindowSecsParam, WindowSecsSelect } from "./WindowSecsSelect"

const ROWS_PER_PAGE = 50

// oxlint-disable-next-line i18next/no-literal-string
const PARAM_ENDPOINT = "endpoint"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_SUCCEEDED = "succeeded"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_WORKER = "worker_name"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_REGISTRATION = "credit_registration_id"
// oxlint-disable-next-line i18next/no-literal-string
const ANY = ""
// oxlint-disable-next-line i18next/no-literal-string
const SUCCEEDED = "true"
// oxlint-disable-next-line i18next/no-literal-string
const FAILED = "false"

// `satisfies` keeps this exhaustive over the endpoint enum, so a new one can't silently vanish
// from the filter.
const SUOTAR_ENDPOINT_KEYS = {
  resolve_persons: true,
  resolve_enrolments: true,
  import_attainments: true,
  verify_attainments: true,
  product_access_tokens: true,
  list_by_course: true,
} satisfies Record<SuotarEndpoint, true>

const ENDPOINTS = Object.keys(SUOTAR_ENDPOINT_KEYS) as SuotarEndpoint[]

const isSuotarEndpoint = (value: string | undefined): value is SuotarEndpoint =>
  value !== undefined && (ENDPOINTS as string[]).includes(value)

interface FilterFields {
  endpoint: string
  succeeded: string
  worker_name: string
  credit_registration_id: string
}

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  selectFilterField(PARAM_ENDPOINT, "endpoint"),
  selectFilterField(PARAM_SUCCEEDED, "succeeded"),
  selectFilterField(PARAM_WORKER, "worker_name"),
]

const EndpointSummary: React.FC = () => {
  const { t } = useTranslation()
  const healthQuery = useSuotarHealth()
  const { control, windowSecs } = useWindowSecsParam(DAY_SECS)

  return (
    <>
      <div className={controlCss}>
        <WindowSecsSelect control={control} />
      </div>
      <QueryResult query={healthQuery} refreshIndicator={QUIET_REFRESH}>
        {(health) => {
          const endpoints =
            health.windows.find((window) => window.window_secs === windowSecs)?.endpoints ?? []
          return endpoints.length === 0 ? (
            <p className={noteCss}>{t("credit-registration-admin-no-calls-in-window")}</p>
          ) : (
            <Table
              caption={t("credit-registration-heading-endpoints")}
              rowKey={(row) => row.endpoint}
              rows={endpoints}
              columns={[
                { header: t("label-endpoint"), cell: (row) => <code>{row.endpoint}</code> },
                {
                  header: t("credit-registration-admin-column-calls"),
                  align: ALIGN_END,
                  cell: (row) => row.call_count,
                },
                {
                  header: t("credit-registration-admin-column-failed-calls"),
                  align: ALIGN_END,
                  cell: (row) => row.failed_call_count,
                },
                {
                  header: t("credit-registration-admin-column-error-items"),
                  align: ALIGN_END,
                  cell: (row) => row.error_item_count,
                },
                {
                  header: t("label-credit-registration-p95-ms"),
                  align: ALIGN_END,
                  cell: (row) => row.p95_duration_ms ?? RELATIVE_TIME_ABSENT_LABEL,
                },
                {
                  header: t("label-credit-registration-last-failure"),
                  cell: (row) => (
                    <span>
                      <RelativeTime at={row.last_failure_at} absoluteTime={TIME_IN_TITLE} />
                      {row.last_request_level_error_code && (
                        <code>{row.last_request_level_error_code}</code>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          )
        }}
      </QueryResult>
    </>
  )
}

/** The transport boundary's own log: one row per HTTP call, with the ledger rows it carried. */
const ApiLogSection: React.FC = () => {
  const { t } = useTranslation()
  const workerNamesQuery = useSuotarWorkerNames()

  const { control, applyParams, handleSubmit, paginationInfo, query } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filters, pagination) => {
      const endpoint = filters.param(PARAM_ENDPOINT)
      const succeeded = filters.param(PARAM_SUCCEEDED)
      const worker = filters.param(PARAM_WORKER)
      const registrationId = filters.param(PARAM_REGISTRATION)
      const validEndpoint = isSuotarEndpoint(endpoint) ? endpoint : undefined
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(validEndpoint, { endpoint: validEndpoint as SuotarEndpoint }),
        ...includeIf(succeeded, { succeeded: succeeded === SUCCEEDED }),
        ...includeIf(worker, { worker_name: worker }),
        ...includeIf(registrationId, { credit_registration_id: registrationId }),
      }
    },
    {
      rowsPerPage: ROWS_PER_PAGE,
      manualDefaults: (filters) => ({
        credit_registration_id: filters.param(PARAM_REGISTRATION) ?? "",
      }),
    },
  )

  const callsQuery = useSuotarApiCalls(query)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-endpoints")}</h2>
      <EndpointSummary />
      <h3 className={headingCss}>{t("credit-registration-heading-api-calls")}</h3>
      <form
        className={controlsCss}
        onSubmit={handleSubmit((fields) =>
          applyParams({ [PARAM_REGISTRATION]: fields.credit_registration_id.trim() }),
        )}
      >
        <div className={controlCss}>
          <Select
            name="endpoint"
            control={control}
            label={t("label-endpoint")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-endpoint") },
              ...ENDPOINTS.map((endpoint) => ({ value: endpoint, label: endpoint })),
            ]}
          />
        </div>
        <div className={controlCss}>
          <Select
            name="succeeded"
            control={control}
            label={t("label-status")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-outcome") },
              { value: SUCCEEDED, label: t("credit-registration-admin-call-succeeded") },
              { value: FAILED, label: t("credit-registration-admin-call-failed") },
            ]}
          />
        </div>
        <div className={controlCss}>
          <Select
            name="worker_name"
            control={control}
            label={t("credit-registration-admin-column-caller")}
            options={[
              { value: ANY, label: t("credit-registration-admin-any-caller") },
              ...(workerNamesQuery.data ?? []).map((name) => ({ value: name, label: name })),
            ]}
          />
        </div>
        <div className={controlCss}>
          <TextField
            name="credit_registration_id"
            control={control}
            label={t("label-credit-registration-registration")}
            description={t("credit-registration-admin-search-by-registration-note")}
          />
        </div>
      </form>
      <QueryResult query={callsQuery} refreshIndicator={QUIET_REFRESH}>
        {(page) =>
          page.data.length === 0 ? (
            <p className={noteCss}>{t("credit-registration-admin-no-matching-calls")}</p>
          ) : (
            <>
              <p className={noteCss}>
                {t("credit-registration-admin-call-count", { count: page.total_count })}
              </p>
              <Table
                caption={t("credit-registration-heading-api-calls")}
                rowKey={(row) => row.id}
                rows={page.data}
                columns={[
                  {
                    header: t("label-time"),
                    cell: (row) => (
                      <RelativeTime at={row.started_at} absoluteTime={TIME_IN_TITLE} />
                    ),
                  },
                  { header: t("label-endpoint"), cell: (row) => <code>{row.endpoint}</code> },
                  {
                    header: t("credit-registration-admin-column-caller"),
                    cell: (row) => <code>{row.worker_name}</code>,
                  },
                  {
                    header: t("label-status"),
                    cell: (row) => (
                      <Badge tone={row.succeeded ? TONE.SUCCESS : TONE.DANGER}>
                        {row.http_status === null
                          ? t("credit-registration-admin-no-http-answer")
                          : String(row.http_status)}
                      </Badge>
                    ),
                  },
                  {
                    header: t("credit-registration-admin-column-items"),
                    cell: (row) =>
                      t("credit-registration-admin-call-items", {
                        requested: row.request_item_count,
                        ok: row.ok_item_count,
                        failed: row.error_item_count,
                      }),
                  },
                  {
                    header: t("credit-registration-admin-column-duration-ms"),
                    align: ALIGN_END,
                    cell: (row) => row.duration_ms ?? RELATIVE_TIME_ABSENT_LABEL,
                  },
                  {
                    header: t("label-actions"),
                    cell: (row) => <SuotarApiCallDetail suotarApiCallId={row.id} />,
                  },
                ]}
              />
              <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
            </>
          )
        }
      </QueryResult>
    </section>
  )
}

export default ApiLogSection
