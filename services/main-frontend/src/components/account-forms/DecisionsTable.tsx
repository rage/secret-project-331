"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getAccountFormRulesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { AccountFormDecision } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { ABSENT_LABEL, Table } from "@/shared-module/components"

import { actionLabel, codeCss, DENSITY_COMPACT, outcomeLabel } from "./shared"

interface DecisionsTableProps {
  decisions: AccountFormDecision[]
  caption: string
}

/** Logged submissions with their signals, one expandable row each. */
const DecisionsTable: React.FC<DecisionsTableProps> = ({ decisions, caption }) => {
  const { t } = useTranslation()
  const rulesQuery = useQuery(getAccountFormRulesOptions())
  // Deleted rules are not listed, so they show by id.
  const ruleName = (id: string) => rulesQuery.data?.find((rule) => rule.id === id)?.name ?? id
  return (
    <Table
      caption={caption}
      density={DENSITY_COMPACT}
      rows={decisions}
      rowKey={(decision) => decision.id}
      expandableRow={(decision) => (
        <pre className={codeCss}>{JSON.stringify(decision.signals, null, 2)}</pre>
      )}
      columns={[
        { header: t("account-forms-column-time"), cell: (d) => dateToString(d.created_at) },
        { header: t("account-forms-column-action"), cell: (d) => actionLabel(t, d.action) },
        { header: t("account-forms-column-outcome"), cell: (d) => outcomeLabel(t, d.outcome) },
        {
          header: t("account-forms-column-matched-rules"),
          cell: (d) =>
            d.matched_rule_ids.length > 0
              ? d.matched_rule_ids.map(ruleName).join(", ")
              : ABSENT_LABEL,
          breakAnywhere: true,
        },
        {
          header: t("account-forms-column-recipient-domain"),
          cell: (d) => d.recipient_domain ?? ABSENT_LABEL,
          breakAnywhere: true,
        },
        {
          header: t("account-forms-column-network-prefix"),
          cell: (d) => d.network_prefix ?? ABSENT_LABEL,
          breakAnywhere: true,
        },
      ]}
    />
  )
}

export default DecisionsTable
