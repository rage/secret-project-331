"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { AgentChangesetCall } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import { Disclosure } from "@/shared-module/components"

interface AgentCallListProps {
  calls: AgentChangesetCall[]
}

/** The agent's write calls that make up the changeset: the audit trail of what it did. */
const AgentCallList: React.FC<AgentCallListProps> = ({ calls }) => {
  const { t } = useTranslation()
  return (
    <Disclosure
      title={t("agent-calls-title")}
      summary={t("agent-calls-count", { count: calls.length })}
      data-testid="agent-calls-disclosure"
    >
      <ol
        data-testid="agent-calls"
        className={css`
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        {calls.map((call) => (
          <li key={call.id}>
            <div>{call.summary ?? call.tool_name}</div>
            <div
              className={css`
                font-size: 0.875rem;
                color: ${baseTheme.colors.gray[500]};
              `}
            >
              {t("agent-call-details", {
                time: dateToString(call.created_at),
                client: call.client_name,
                tool: call.tool_name,
              })}
              {call.revert_of_call_id && ` ${t("agent-call-is-revert")}`}
            </div>
          </li>
        ))}
      </ol>
    </Disclosure>
  )
}

export default AgentCallList
