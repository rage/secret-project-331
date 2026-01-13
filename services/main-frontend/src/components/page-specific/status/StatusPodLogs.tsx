import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { useStatusPodLogs } from "@/hooks/useStatusPodLogs"
import { useStatusPods } from "@/hooks/useStatusPods"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusPodLogs: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods } = useStatusPods()
  const [selectedPod, setSelectedPod] = useState<string>("")
  const [tail, setTail] = useState<number>(100)
  const { data: logs, isLoading, error } = useStatusPodLogs(selectedPod || null, undefined, tail)

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
          <SelectMenu
            id="pod-select"
            label={t("status-select-pod")}
            value={selectedPod}
            onChange={(e) => setSelectedPod(e.currentTarget.value)}
            options={pods?.map((pod) => ({ value: pod.name, label: pod.name })) || []}
            showDefaultOption={true}
          />
        </div>
        <div
          className={css`
            width: 150px;
          `}
        >
          <SelectMenu
            id="tail-select"
            label={t("status-tail-lines")}
            value={tail.toString()}
            onChange={(e) => setTail(parseInt(e.currentTarget.value, 10))}
            options={[
              { value: "50", label: "50" },
              { value: "100", label: "100" },
              { value: "200", label: "200" },
              { value: "500", label: "500" },
            ]}
            showDefaultOption={false}
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
            font-family: "Courier New", monospace;
            font-size: 12px;
            max-height: 600px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
          `}
        >
          {isLoading && <Spinner />}
          {error && <ErrorBanner error={error} />}
          {logs && <div>{logs}</div>}
        </div>
      )}
    </div>
  )
}

export default StatusPodLogs
