"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle, InfoCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusEvents } from "@/hooks/useStatusEvents"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { QueryResult, Select, Table } from "@/shared-module/components"

const FILTER_ALL = "all" as const
const FILTER_ERROR = "error" as const
const FILTER_WARNING = "warning" as const
const FILTER_NORMAL = "normal" as const

const nowrapCss = css`
  white-space: nowrap;
`

const StatusEvents: React.FC = () => {
  const { t } = useTranslation()
  const eventsQuery = useStatusEvents()
  const events = eventsQuery.data
  const { control, watch } = useForm<{
    filterType:
      | typeof FILTER_ALL
      | typeof FILTER_ERROR
      | typeof FILTER_WARNING
      | typeof FILTER_NORMAL
  }>({
    defaultValues: { filterType: FILTER_ALL },
  })
  const filterType = watch("filterType")

  // Filter and sort events - must be called before early returns
  const filteredAndSortedEvents = useMemo(() => {
    if (!events || events.length === 0) {
      return []
    }

    let filtered = [...events]

    if (filterType !== "all") {
      filtered = filtered.filter((e) => {
        // oxlint-disable-next-line i18next/no-literal-string
        const type = e.type_ || "Normal"
        if (filterType === "warning") {
          return type === "Warning"
        }
        if (filterType === "error") {
          return type === "Error"
        }
        if (filterType === "normal") {
          return type === "Normal" || !e.type_
        }
        return true
      })
    }

    // Sort by last timestamp (most recent first)
    return filtered.toSorted((a, b) => {
      const aTime = a.last_timestamp || a.first_timestamp || ""
      const bTime = b.last_timestamp || b.first_timestamp || ""
      return bTime.localeCompare(aTime)
    })
  }, [events, filterType])

  return (
    <QueryResult query={eventsQuery} emptyFallback={<p>{t("status-no-events-found")}</p>}>
      {(loadedEvents) => (
        <div>
          <div
            className={css`
              display: flex;
              gap: 1rem;
              margin-bottom: 1rem;
              align-items: center;
            `}
          >
            <Select
              name="filterType"
              control={control}
              label={t("status-filter")}
              options={[
                { value: FILTER_ALL, label: t("status-filter-all-events") },
                { value: FILTER_ERROR, label: t("status-filter-errors-only") },
                { value: FILTER_WARNING, label: t("status-filter-warnings-only") },
                { value: FILTER_NORMAL, label: t("status-filter-normal-only") },
              ]}
            />
            <span
              className={css`
                color: ${baseTheme.colors.gray[500]};
                font-size: 0.9rem;
              `}
            >
              {t("status-showing-events", {
                count: filteredAndSortedEvents.length,
                total: loadedEvents.length,
              })}
            </span>
          </div>
          <Table
            caption={t("status-events")}
            density={DENSITY_COMPACT}
            rowHover
            rows={filteredAndSortedEvents}
            rowKey={(event) => event.name}
            className={css`
              margin-top: 1rem;
            `}
            columns={[
              {
                header: t("status-type"),
                cell: (event) => (
                  <div
                    className={css`
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    {event.type_ === "Error" && (
                      <XmarkCircle size={16} color={baseTheme.colors.red[600]} />
                    )}
                    {event.type_ === "Warning" && (
                      <ExclamationTriangle size={16} color={baseTheme.colors.yellow[700]} />
                    )}
                    {(!event.type_ || event.type_ === "Normal") && (
                      <InfoCircle size={16} color={baseTheme.colors.blue[600]} />
                    )}
                    <span>{event.type_ || t("status-normal")}</span>
                  </div>
                ),
              },
              { header: t("status-reason"), cell: (event) => event.reason || "-" },
              {
                header: t("status-object"),
                cell: (event) =>
                  event.involved_object_kind && event.involved_object_name
                    ? `${event.involved_object_kind}/${event.involved_object_name}`
                    : "-",
              },
              { header: t("status-message"), cell: (event) => event.message || "-" },
              { header: t("status-count"), cell: (event) => event.count || 0 },
              {
                header: t("status-last-timestamp"),
                cell: (event) => {
                  const timestamp = event.last_timestamp || event.first_timestamp
                  return timestamp ? (
                    <span className={nowrapCss}>{dateToString(timestamp)}</span>
                  ) : (
                    "-"
                  )
                },
              },
            ]}
          />
        </div>
      )}
    </QueryResult>
  )
}

export default StatusEvents
