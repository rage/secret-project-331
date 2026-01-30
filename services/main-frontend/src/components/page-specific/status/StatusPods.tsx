"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, Question, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useStatusPodLogs } from "@/hooks/useStatusPodLogs"
import { useStatusPods } from "@/hooks/useStatusPods"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import { parseAnsiToReact } from "@/utils/parseAnsiToReact"

const StatusPods: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods, isLoading, error } = useStatusPods()
  const [selectedPod, setSelectedPod] = useState<string | null>(null)
  const [tail, setTail] = useState<number>(100)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
  } = useStatusPodLogs(selectedPod, undefined, tail)

  useEffect(() => {
    if (logs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs])

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
              border-bottom: 1px solid ${baseTheme.colors.clear[300]};
            }

            th {
              background-color: ${baseTheme.colors.clear[100]};
              font-weight: 600;
            }

            tr:hover {
              background-color: ${baseTheme.colors.clear[200]};
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
              const isFailed = pod.phase === "Failed"
              const isPending = pod.phase === "Pending"
              const isSucceeded = pod.phase === "Succeeded"
              return (
                <tr
                  key={pod.name}
                  className={css`
                    ${isFailed ? `background-color: ${baseTheme.colors.red[100]};` : ""}
                    ${isPending ? `background-color: ${baseTheme.colors.yellow[100]};` : ""}
                    ${isSucceeded ? `background-color: ${baseTheme.colors.clear[200]};` : ""}
                  `}
                >
                  <td>{pod.name}</td>
                  <td>
                    <div
                      className={css`
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                      `}
                    >
                      {isHealthy && <CheckCircle size={16} color={baseTheme.colors.green[600]} />}
                      {isFailed && <XmarkCircle size={16} color={baseTheme.colors.red[600]} />}
                      {isPending && <Clock size={16} color={baseTheme.colors.yellow[700]} />}
                      {isSucceeded && <CheckCircle size={16} color={baseTheme.colors.green[600]} />}
                      {!isHealthy && !isFailed && !isPending && !isSucceeded && (
                        <Question size={16} color={baseTheme.colors.gray[500]} />
                      )}
                      <span
                        className={css`
                          padding: 0.25rem 0.5rem;
                          border-radius: 4px;
                          font-size: 0.85rem;
                          font-weight: 600;
                          background-color: ${isHealthy
                            ? baseTheme.colors.green[100]
                            : isFailed
                              ? baseTheme.colors.red[100]
                              : isPending
                                ? baseTheme.colors.yellow[100]
                                : isSucceeded
                                  ? baseTheme.colors.green[100]
                                  : baseTheme.colors.clear[300]};
                          color: ${isHealthy
                            ? baseTheme.colors.green[700]
                            : isFailed
                              ? baseTheme.colors.red[700]
                              : isPending
                                ? baseTheme.colors.yellow[700]
                                : isSucceeded
                                  ? baseTheme.colors.green[700]
                                  : baseTheme.colors.gray[600]};
                        `}
                      >
                        {pod.phase}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div
                      className={css`
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                      `}
                    >
                      {pod.ready === true ? (
                        <CheckCircle size={20} color={baseTheme.colors.green[600]} />
                      ) : pod.phase === "Succeeded" ? (
                        <CheckCircle size={20} color={baseTheme.colors.gray[400]} />
                      ) : pod.ready === false ? (
                        <XmarkCircle size={20} color={baseTheme.colors.red[600]} />
                      ) : (
                        <Question size={20} color={baseTheme.colors.yellow[600]} />
                      )}
                    </div>
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
                htmlFor="tail-lines-select"
                className={css`
                  font-weight: 600;
                `}
              >
                {t("status-tail-lines")}:
              </label>
              <select
                id="tail-lines-select"
                value={tail}
                onChange={(e) => setTail(parseInt(e.currentTarget.value, 10))}
                className={css`
                  padding: 0.5rem;
                  border: 1px solid ${baseTheme.colors.clear[300]};
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
              ref={logsContainerRef}
              className={css`
                border: 1px solid ${baseTheme.colors.clear[300]};
                border-radius: 4px;
                padding: 1rem;
                background-color: #1e1e1e;
                color: #d4d4d4;
                font-family: ${monospaceFont};
                font-size: 12px;
                line-height: 1.4;
                max-height: 600px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-break: break-all;
              `}
            >
              {logsLoading && <Spinner />}
              {logsError && <ErrorBanner error={logsError} />}
              {logs && <div>{parseAnsiToReact(logs)}</div>}
            </div>
          </div>
        </StandardDialog>
      )}
    </>
  )
}

export default StatusPods
