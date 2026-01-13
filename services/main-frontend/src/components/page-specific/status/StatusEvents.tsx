"use client"

import { css } from "@emotion/css"
import { ExclamationTriangle, InfoCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useStatusEvents } from "@/hooks/useStatusEvents"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusEvents: React.FC = () => {
  const { t } = useTranslation()
  const { data: events, isLoading, error } = useStatusEvents()
  // eslint-disable-next-line i18next/no-literal-string
  const [filterType, setFilterType] = useState<"all" | "warning" | "error" | "normal">("all")

  // Filter and sort events - must be called before early returns
  const filteredAndSortedEvents = useMemo(() => {
    if (!events || events.length === 0) {
      return []
    }

    let filtered = [...events]

    if (filterType !== "all") {
      filtered = filtered.filter((e) => {
        // eslint-disable-next-line i18next/no-literal-string
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
    return filtered.sort((a, b) => {
      const aTime = a.last_timestamp || a.first_timestamp || ""
      const bTime = b.last_timestamp || b.first_timestamp || ""
      return bTime.localeCompare(aTime)
    })
  }, [events, filterType])

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!events || events.length === 0) {
    return <p>{t("status-no-events-found")}</p>
  }

  return (
    <div>
      <div
        className={css`
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          align-items: center;
        `}
      >
        <label
          className={css`
            font-weight: 600;
          `}
        >
          {t("status-filter")}:
        </label>
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.currentTarget.value as "all" | "warning" | "error" | "normal")
          }
          className={css`
            padding: 0.5rem;
            border: 1px solid ${baseTheme.colors.clear[300]};
            border-radius: 4px;
          `}
        >
          <option value="all">{t("status-filter-all-events")}</option>
          <option value="error">{t("status-filter-errors-only")}</option>
          <option value="warning">{t("status-filter-warnings-only")}</option>
          <option value="normal">{t("status-filter-normal-only")}</option>
        </select>
        <span
          className={css`
            color: ${baseTheme.colors.gray[500]};
            font-size: 0.9rem;
          `}
        >
          {t("status-showing-events", {
            count: filteredAndSortedEvents.length,
            total: events.length,
          })}
        </span>
      </div>
      <div
        className={css`
          overflow-x: auto;
        `}
      >
        <table
          className={css`
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;

            th,
            td {
              padding: 0.5rem;
              text-align: left;
              border-bottom: 1px solid ${baseTheme.colors.clear[300]};
            }

            th {
              background-color: ${baseTheme.colors.clear[100]};
              font-weight: 600;
            }

            tr:hover {
              background-color: ${baseTheme.colors.clear[200]};
            }

            .type-warning {
              background-color: ${baseTheme.colors.yellow[100]};
            }

            .type-error {
              background-color: ${baseTheme.colors.red[100]};
            }
          `}
        >
          <thead>
            <tr>
              <th>{t("status-type")}</th>
              <th>{t("status-reason")}</th>
              <th>{t("status-object")}</th>
              <th>{t("status-message")}</th>
              <th>{t("status-count")}</th>
              <th>{t("status-last-timestamp")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEvents.map((event) => (
              <tr
                key={event.name}
                className={css`
                  ${event.type_ === "Warning"
                    ? `background-color: ${baseTheme.colors.yellow[100]};`
                    : ""}
                  ${event.type_ === "Error"
                    ? `background-color: ${baseTheme.colors.red[100]};`
                    : ""}
                `}
              >
                <td>
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
                </td>
                <td>{event.reason || "-"}</td>
                <td>
                  {event.involved_object_kind && event.involved_object_name
                    ? `${event.involved_object_kind}/${event.involved_object_name}`
                    : "-"}
                </td>
                <td
                  className={css`
                    max-width: 400px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `}
                >
                  {event.message || "-"}
                </td>
                <td>{event.count || 0}</td>
                <td>{event.last_timestamp || event.first_timestamp || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StatusEvents
