"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useStatusPodLogs } from "@/hooks/useStatusPodLogs"
import { useStatusPods } from "@/hooks/useStatusPods"
import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import { QueryResult, Select } from "@/shared-module/components"

const FIELD_SELECTED_POD = "selectedPod" as const
const FIELD_TAIL_LINES = "tailLines" as const

interface StatusPodLogsFilterValues {
  selectedPod: string
  tailLines: string
}

const StatusPodLogs: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods } = useStatusPods()

  const { control: filterControl } = useForm<StatusPodLogsFilterValues>({
    defaultValues: { selectedPod: "", tailLines: "100" },
  })
  const selectedPod = useWatch({ control: filterControl, name: FIELD_SELECTED_POD })
  const tailLines = useWatch({ control: filterControl, name: FIELD_TAIL_LINES })
  // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
  const tail = parseInt(tailLines, 10)
  const logsQuery = useStatusPodLogs(selectedPod || null, undefined, tail)

  return (
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
          align-items: flex-end;
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        >
          <Select
            id="pod-select"
            control={filterControl}
            name={FIELD_SELECTED_POD}
            label={t("status-select-pod")}
            options={pods?.map((pod) => ({ value: pod.name, label: pod.name })) || []}
          />
        </div>
        <div
          className={css`
            width: 150px;
          `}
        >
          <Select
            id="tail-select"
            control={filterControl}
            name={FIELD_TAIL_LINES}
            label={t("status-tail-lines")}
            options={[
              { value: "50", label: "50" },
              { value: "100", label: "100" },
              { value: "200", label: "200" },
              { value: "500", label: "500" },
            ]}
          />
        </div>
      </div>

      {selectedPod && (
        <div
          className={css`
            border: 1px solid ${baseTheme.colors.clear[300]};
            border-radius: 4px;
            padding: 1rem;
            background-color: ${baseTheme.colors.gray[700]};
            color: ${baseTheme.colors.gray[300]};
            font-family: ${monospaceFont};
            font-size: 12px;
            max-height: 600px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
          `}
        >
          <QueryResult query={logsQuery} themeMode="dark">
            {(logs) => logs && <div>{logs}</div>}
          </QueryResult>
        </div>
      )}
    </div>
  )
}

export default StatusPodLogs
