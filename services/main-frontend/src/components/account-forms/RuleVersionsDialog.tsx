"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getAccountFormRuleVersionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { AccountFormRule } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { Dialog, ErrorNotice, LoadingRegion, Table } from "@/shared-module/components"

import { codeCss, DENSITY_COMPACT, matcherSummary, outcomeLabel, yesNo } from "./shared"

interface RuleVersionsDialogProps {
  rule: AccountFormRule
  onClose: () => void
}

/** Who saved which version of a rule and when, newest first. */
const RuleVersionsDialog: React.FC<RuleVersionsDialogProps> = ({ rule, onClose }) => {
  const { t } = useTranslation()
  const versionsQuery = useQuery(getAccountFormRuleVersionsOptions({ path: { id: rule.id } }))
  const title = t("account-forms-rule-versions-title", { name: rule.name })

  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      showCloseButton={false}
      title={title}
      actions={[{ label: t("button-text-close"), variant: "secondary", onPress: onClose }]}
    >
      {versionsQuery.isError && <ErrorNotice error={versionsQuery.error} />}
      {versionsQuery.isLoading && <LoadingRegion />}
      {versionsQuery.data && (
        <Table
          caption={title}
          density={DENSITY_COMPACT}
          rows={versionsQuery.data}
          rowKey={(version) => version.id}
          columns={[
            { header: t("account-forms-column-time"), cell: (v) => dateToString(v.created_at) },
            {
              header: t("account-forms-column-changed-by"),
              cell: (v) => v.changed_by_user_id,
              breakAnywhere: true,
            },
            {
              header: t("account-forms-column-change"),
              cell: (v) =>
                v.deleted ? (
                  t("account-forms-rule-version-deleted")
                ) : (
                  <>
                    <div>
                      {v.name}: {outcomeLabel(t, v.outcome)}
                    </div>
                    <div>
                      {t("account-forms-column-enabled")}: {yesNo(t, v.enabled)},{" "}
                      {t("account-forms-column-log-only")}: {yesNo(t, v.log_only)}
                    </div>
                    <div className={codeCss}>
                      {v.expression ?? `${matcherSummary(t, v)}: ${v.list_entries.join(", ")}`}
                    </div>
                  </>
                ),
            },
          ]}
        />
      )}
    </Dialog>
  )
}

export default RuleVersionsDialog
