"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, Question, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import { useStatusPodLogs } from "@/hooks/useStatusPodLogs"
import { useStatusPods } from "@/hooks/useStatusPods"
import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import { Button, Dialog, QueryResult, Select, Table } from "@/shared-module/components"
import { parseAnsiToReact } from "@/utils/parseAnsiToReact"

const StatusPods: React.FC = () => {
  const { t } = useTranslation()
  const podsQuery = useStatusPods()
  const [selectedPod, setSelectedPod] = useState<string | null>(null)
  const { control, watch } = useForm<{ tail: string }>({ defaultValues: { tail: "100" } })
  const tail = Number(watch("tail"))
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const logsQuery = useStatusPodLogs(selectedPod, undefined, tail)

  useEffect(() => {
    if (logsQuery.data && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logsQuery.data])

  return (
    <>
      <QueryResult query={podsQuery} emptyFallback={<p>{t("status-no-pods-found")}</p>}>
        {(pods) => (
          <Table
            caption={t("status-pods")}
            density={DENSITY_COMPACT}
            rowHover
            rows={pods}
            rowKey={(pod) => pod.name}
            className={css`
              margin-top: 1rem;
            `}
            columns={[
              { header: t("status-name"), cell: (pod) => pod.name },
              {
                header: t("status-phase"),
                cell: (pod) => {
                  const isHealthy = pod.ready === true && pod.phase === "Running"
                  const isFailed = pod.phase === "Failed"
                  const isPending = pod.phase === "Pending"
                  const isSucceeded = pod.phase === "Succeeded"
                  return (
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
                          background-color: ${
                            isHealthy
                              ? baseTheme.colors.green[100]
                              : isFailed
                                ? baseTheme.colors.red[100]
                                : isPending
                                  ? baseTheme.colors.yellow[100]
                                  : isSucceeded
                                    ? baseTheme.colors.green[100]
                                    : baseTheme.colors.clear[300]
                          };
                          color: ${
                            isHealthy
                              ? baseTheme.colors.green[700]
                              : isFailed
                                ? baseTheme.colors.red[700]
                                : isPending
                                  ? baseTheme.colors.yellow[700]
                                  : isSucceeded
                                    ? baseTheme.colors.green[700]
                                    : baseTheme.colors.gray[600]
                          };
                        `}
                      >
                        {pod.phase}
                      </span>
                    </div>
                  )
                },
              },
              {
                header: t("status-ready"),
                cell: (pod) => (
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
                ),
              },
              {
                header: t("status-actions"),
                cell: (pod) => (
                  <Button variant="secondary" size="small" onClick={() => setSelectedPod(pod.name)}>
                    {t("status-view-logs")}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </QueryResult>

      {selectedPod && (
        <Dialog
          open={!!selectedPod}
          onClose={() => setSelectedPod(null)}
          title={`${t("status-logs")}: ${selectedPod}`}
          size="wide"
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
              <Select
                name="tail"
                control={control}
                label={t("status-tail-lines")}
                options={["50", "100", "200", "500"].map((n) => ({ value: n, label: n }))}
              />
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
              <QueryResult query={logsQuery} themeMode="dark">
                {(logs) => logs && <div>{parseAnsiToReact(logs)}</div>}
              </QueryResult>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

export default StatusPods
