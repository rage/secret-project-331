"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  HOUR_SECS,
  useSuotarApiCalls,
  useSuotarHealth,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import SuotarApiCallDetail from "@/components/credit-registration/admin/SuotarApiCallDetail"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import { TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import type { SuotarEndpoint } from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Badge, QueryResult, Select, Table, TextField } from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const DAY_SECS = 86_400
const WEEK_SECS = 604_800

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

// oxlint-disable-next-line i18next/no-literal-string
const ENDPOINTS: SuotarEndpoint[] = [
  "resolve_persons",
  "resolve_enrolments",
  "import_attainments",
  "verify_attainments",
  "product_access_tokens",
  "list_by_course",
]

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

interface WindowFields {
  window_secs: string
}

const controlsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
`

const controlCss = css`
  min-width: 12rem;
`

const EndpointSummarySection: React.FC = () => {
  const { t } = useTranslation()
  const healthQuery = useSuotarHealth()
  const { control, watch } = useForm<WindowFields>({
    defaultValues: { window_secs: String(DAY_SECS) },
  })
  const windowSecs = Number(watch("window_secs"))

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-endpoints")}</h2>
      <div className={controlCss}>
        <Select
          name="window_secs"
          control={control}
          label={t("credit-registration-admin-window")}
          options={[
            { value: String(HOUR_SECS), label: t("credit-registration-admin-window-hour") },
            { value: String(DAY_SECS), label: t("credit-registration-admin-window-day") },
            { value: String(WEEK_SECS), label: t("credit-registration-admin-window-week") },
          ]}
        />
      </div>
      <QueryResult query={healthQuery}>
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
                  cell: (row) => row.call_count,
                },
                {
                  header: t("credit-registration-admin-column-failed-calls"),
                  cell: (row) => row.failed_call_count,
                },
                {
                  header: t("credit-registration-admin-column-ok-items"),
                  cell: (row) => row.ok_item_count,
                },
                {
                  header: t("credit-registration-admin-column-error-items"),
                  cell: (row) => row.error_item_count,
                },
                {
                  header: t("credit-registration-admin-column-p50"),
                  cell: (row) => row.p50_duration_ms ?? ABSENT,
                },
                {
                  header: t("label-credit-registration-p95-ms"),
                  cell: (row) => row.p95_duration_ms ?? ABSENT,
                },
                {
                  header: t("credit-registration-admin-column-last-request-error"),
                  cell: (row) =>
                    row.last_request_level_error_code ? (
                      <code>{row.last_request_level_error_code}</code>
                    ) : (
                      ABSENT
                    ),
                },
                {
                  header: t("label-credit-registration-last-success"),
                  cell: (row) => <RelativeTime at={row.last_success_at} />,
                },
                {
                  header: t("label-credit-registration-last-failure"),
                  cell: (row) => <RelativeTime at={row.last_failure_at} />,
                },
              ]}
            />
          )
        }}
      </QueryResult>
    </section>
  )
}

/** The transport boundary's own log: one row per HTTP call, with the ledger rows it carried. */
const ApiLogPage: React.FC = () => {
  const { t } = useTranslation()

  const { control, handleSubmit, applyParams, paginationInfo, query } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filterParam, pagination) => {
      const endpoint = filterParam(PARAM_ENDPOINT)
      const succeeded = filterParam(PARAM_SUCCEEDED)
      const worker = filterParam(PARAM_WORKER)
      const registrationId = filterParam(PARAM_REGISTRATION)
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(endpoint, { endpoint: endpoint as SuotarEndpoint }),
        ...includeIf(succeeded, { succeeded: succeeded === SUCCEEDED }),
        ...includeIf(worker, { worker_name: worker }),
        ...includeIf(registrationId, { credit_registration_id: registrationId }),
      }
    },
    {
      rowsPerPage: ROWS_PER_PAGE,
      manualDefaults: (filterParam) => ({
        credit_registration_id: filterParam(PARAM_REGISTRATION) ?? "",
      }),
    },
  )

  const callsQuery = useSuotarApiCalls(query)

  return (
    <div className={sectionsCss}>
      <EndpointSummarySection />
      <section className={sectionCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-api-calls")}</h2>
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
                ...(callsQuery.data?.worker_names ?? []).map((name) => ({
                  value: name,
                  label: name,
                })),
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
        <QueryResult query={callsQuery}>
          {(page) =>
            page.data.length === 0 ? (
              <p className={noteCss}>{t("credit-registration-admin-no-matching-calls")}</p>
            ) : (
              <>
                <Table
                  caption={t("credit-registration-heading-api-calls")}
                  rowKey={(row) => row.id}
                  rows={page.data}
                  columns={[
                    {
                      header: t("label-time"),
                      cell: (row) => <RelativeTime at={row.started_at} />,
                    },
                    { header: t("label-endpoint"), cell: (row) => <code>{row.endpoint}</code> },
                    {
                      header: t("credit-registration-admin-column-caller"),
                      cell: (row) => <code>{row.worker_name}</code>,
                    },
                    {
                      header: t("label-status"),
                      cell: (row) => (
                        <Badge tone={row.succeeded ? TONE.SUCCESS : TONE.WARNING}>
                          {row.http_status === null
                            ? t("credit-registration-admin-no-http-answer")
                            : String(row.http_status)}
                        </Badge>
                      ),
                    },
                    {
                      header: t("credit-registration-admin-column-request-error"),
                      cell: (row) =>
                        row.request_level_error_code ? (
                          <code>{row.request_level_error_code}</code>
                        ) : (
                          ABSENT
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
                      cell: (row) => row.duration_ms ?? ABSENT,
                    },
                    {
                      header: t("label-actions"),
                      cell: (row) => <SuotarApiCallDetail suotarApiCallId={row.id} />,
                    },
                  ]}
                />
                <p className={noteCss}>
                  {t("credit-registration-admin-call-count", { count: page.total_count })}
                </p>
                <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
              </>
            )
          }
        </QueryResult>
      </section>
    </div>
  )
}

export default ApiLogPage
