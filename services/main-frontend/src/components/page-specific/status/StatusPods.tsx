import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { useStatusPodLogs } from "../../../hooks/useStatusPodLogs"
import { useStatusPods } from "../../../hooks/useStatusPods"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

const StatusPods: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods, isLoading, error } = useStatusPods()
  const [selectedPod, setSelectedPod] = useState<string | null>(null)
  const [tail, setTail] = useState<number>(100)
  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
  } = useStatusPodLogs(selectedPod, undefined, tail)

  if (isLoading) {
    return <Spinner />
  }

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (!pods || pods.length === 0) {
    return <p>{t("status-no-pods-found")}</p>
  }

  return (
    <>
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
              border-bottom: 1px solid #ddd;
            }

            th {
              background-color: #f5f5f5;
              font-weight: 600;
            }

            tr:hover {
              background-color: #f9f9f9;
            }
          `}
        >
          <thead>
            <tr>
              <th>{t("status-name")}</th>
              <th>{t("status-phase")}</th>
              <th>{t("status-ready")}</th>
              <th>{t("status-actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pods.map((pod) => {
              const isHealthy = pod.ready === true && pod.phase === "Running"
              const isFailed = pod.phase === "Failed" || pod.ready === false
              const isPending = pod.phase === "Pending"
              return (
                <tr
                  key={pod.name}
                  className={css`
                    ${isFailed ? "background-color: #f8d7da;" : ""}
                    ${isPending ? "background-color: #fff3cd;" : ""}
                  `}
                >
                  <td>{pod.name}</td>
                  <td>
                    <span
                      className={css`
                        padding: 0.25rem 0.5rem;
                        border-radius: 4px;
                        font-size: 0.85rem;
                        font-weight: 600;
                        background-color: ${isHealthy
                          ? "#d4edda"
                          : isFailed
                            ? "#f8d7da"
                            : isPending
                              ? "#fff3cd"
                              : "#e9ecef"};
                        color: ${isHealthy
                          ? "#155724"
                          : isFailed
                            ? "#721c24"
                            : isPending
                              ? "#856404"
                              : "#495057"};
                      `}
                    >
                      {pod.phase}
                    </span>
                  </td>
                  <td>
                    <span
                      className={css`
                        font-size: 1.2rem;
                        color: ${pod.ready === true
                          ? "#28a745"
                          : pod.ready === false
                            ? "#dc3545"
                            : "#ffc107"};
                      `}
                    >
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      {pod.ready === true ? "✓" : pod.ready === false ? "✗" : "?"}
                    </span>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setSelectedPod(pod.name)}
                    >
                      {t("status-view-logs")}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedPod && (
        <StandardDialog
          open={!!selectedPod}
          onClose={() => setSelectedPod(null)}
          title={`${t("status-logs")}: ${selectedPod}`}
          width="wide"
          buttons={[
            {
              variant: "secondary",
              onClick: () => setSelectedPod(null),
              children: t("status-close"),
            },
          ]}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                gap: 1rem;
                align-items: center;
              `}
            >
              <label
                className={css`
                  font-weight: 600;
                `}
              >
                {t("status-tail-lines")}:
              </label>
              <select
                value={tail}
                onChange={(e) => setTail(parseInt(e.currentTarget.value, 10))}
                className={css`
                  padding: 0.5rem;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                `}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <div
              className={css`
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 1rem;
                background-color: #1e1e1e;
                color: #d4d4d4;
                font-family: "Courier New", monospace;
                font-size: 12px;
                max-height: 600px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-break: break-all;
              `}
            >
              {logsLoading && <Spinner />}
              {logsError && <ErrorBanner error={logsError} />}
              {logs && <div>{logs}</div>}
            </div>
          </div>
        </StandardDialog>
      )}
    </>
  )
}

export default StatusPods
