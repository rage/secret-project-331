"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { SuotarEndpoint } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  Pagination,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  DENSITY_COMPACT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
} from "../constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  stackedCellCss,
} from "../styles"
import { useSuotarApiCalls } from "./adminCreditRegistrationHooks"
import HttpStatusBadge from "./HttpStatusBadge"
import SuotarApiCallDetail from "./SuotarApiCallDetail"
import type { FilterFieldDescriptor } from "./useFilteredAdminQuery"
import { selectFilterField, useFilteredAdminQuery } from "./useFilteredAdminQuery"

const ROWS_PER_PAGE = 50

const PARAM_ENDPOINT = "endpoint"
const PARAM_SUCCEEDED = "succeeded"
const PARAM_WORKER = "worker_name"
const PARAM_REGISTRATION = "credit_registration_id"
const ANY = ""
const SUCCEEDED = "true"
const FAILED = "false"
/** Sentinel for "every outcome", distinct from the unset param so that state is reachable: an
 *  unset `succeeded` param defaults the view to failures only (see `resolveSucceededFilter`). */
const ALL_OUTCOMES = "all"

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
  {
    param: PARAM_SUCCEEDED,
    field: "succeeded",
    // Unset means "not chosen yet", which the query below reads as failures only; "all" is the
    // explicit opt-in to see everything, so it needs its own value distinct from unset.
    fromParam: (raw) => raw ?? FAILED,
    toParam: (value) => (value === FAILED ? undefined : (value as string)),
  },
  selectFilterField(PARAM_WORKER, "worker_name"),
]

/** `succeeded` param -> query value. Unset defaults the log to failures, `all` means no filter. */
const resolveSucceededFilter = (raw: string | undefined): boolean | undefined => {
  if (raw === undefined) {
    return false
  }
  return raw === ALL_OUTCOMES ? undefined : raw === SUCCEEDED
}

/** `worker_name` values are `"<process>/<task>"`; the task is what a reader scans for. */
const splitWorkerName = (workerName: string): { task: string; process: string | null } => {
  const slashIndex = workerName.indexOf("/")
  return slashIndex === -1
    ? { task: workerName, process: null }
    : { task: workerName.slice(slashIndex + 1), process: workerName.slice(0, slashIndex) }
}

/** The transport boundary's own log: one row per HTTP call, with the ledger rows it carried. */
const ApiLogSection: React.FC = () => {
  const { t } = useTranslation()

  const { control, applyParams, handleSubmit, paginationInfo, query } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filters, pagination) => {
      const endpoint = filters.param(PARAM_ENDPOINT)
      const succeeded = resolveSucceededFilter(filters.param(PARAM_SUCCEEDED))
      const worker = filters.param(PARAM_WORKER)
      const registrationId = filters.param(PARAM_REGISTRATION)
      const validEndpoint = isSuotarEndpoint(endpoint) ? endpoint : undefined
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(validEndpoint, { endpoint: validEndpoint }),
        ...includeIf(succeeded !== undefined, { succeeded }),
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
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-api-calls")}</h2>
      </div>
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
              { value: ALL_OUTCOMES, label: t("credit-registration-admin-any-outcome") },
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
      <QueryResult query={callsQuery} refreshIndicator={QUIET_REFRESH}>
        {(page) => (
          <>
            {/* Only where the pager below is absent: it renders nothing under two pages, and its
                own "showing x of y" states the same total more usefully when it is there. */}
            {page.total_pages < 2 && (
              <p className={noteCss}>
                {t("credit-registration-admin-call-count", { count: page.total_count })}
              </p>
            )}
            <Table
              caption={t("credit-registration-heading-api-calls")}
              density={DENSITY_COMPACT}
              responsive={TABLE_STACK}
              rowKey={(row) => row.id}
              rows={page.data}
              emptyState={t("credit-registration-admin-no-matching-calls")}
              columns={[
                {
                  header: t("label-time"),
                  minWidth: "8rem",
                  nowrap: true,
                  cell: (row) => <RelativeTime at={row.started_at} absoluteTime={TIME_COMPACT} />,
                },
                {
                  header: t("label-endpoint"),
                  minWidth: "11rem",
                  cell: (row) => <code>{row.endpoint}</code>,
                },
                {
                  header: t("credit-registration-admin-column-caller"),
                  minWidth: "11rem",
                  nowrap: true,
                  cell: (row) => {
                    const { task, process } = splitWorkerName(row.worker_name)
                    return (
                      <span className={stackedCellCss}>
                        <code>{task}</code>
                        {process && <span className={noteCss}>{process}</span>}
                      </span>
                    )
                  },
                },
                {
                  header: t("label-status"),
                  minWidth: "6rem",
                  nowrap: true,
                  cell: (row) => (
                    <HttpStatusBadge
                      httpStatus={row.http_status}
                      succeeded={row.succeeded}
                      errorItemCount={row.error_item_count}
                    />
                  ),
                },
                {
                  header: t("credit-registration-admin-column-items"),
                  grow: true,
                  minWidth: "10rem",
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
                  minWidth: "5rem",
                  nowrap: true,
                  cell: (row) => row.duration_ms ?? ABSENT,
                },
                {
                  header: t("label-actions"),
                  minWidth: "7rem",
                  cell: (row) => <SuotarApiCallDetail suotarApiCallId={row.id} />,
                },
              ]}
            />
            <Pagination
              page={paginationInfo.page}
              totalPages={page.total_pages}
              onPageChange={paginationInfo.setPage}
              itemsPerPage={paginationInfo.limit}
              totalItems={page.total_count}
              onItemsPerPageChange={paginationInfo.setLimit}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default ApiLogSection
