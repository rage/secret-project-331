"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deleteAccountFormRuleMutation,
  getAccountFormRulesOptions,
  getAccountFormRulesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type { AccountFormRule } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import {
  Button,
  ConfirmDialog,
  ErrorNotice,
  LoadingRegion,
  Table,
} from "@/shared-module/components"

import RuleFormDialog from "./RuleFormDialog"
import RuleVersionsDialog from "./RuleVersionsDialog"
import {
  codeCss,
  DENSITY_COMPACT,
  matcherSummary,
  outcomeLabel,
  stackCss,
  toolbarCss,
  yesNo,
} from "./shared"

type DialogState =
  | { type: "edit"; rule: AccountFormRule | null }
  | { type: "versions"; rule: AccountFormRule }
  | { type: "delete"; rule: AccountFormRule }

/** The rules, and the dialogs to edit, inspect and delete them. */
const RulesSection: React.FC = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const rulesQuery = useQuery(getAccountFormRulesOptions())
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const remove = useToastMutationOptions(
    deleteAccountFormRuleMutation(),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getAccountFormRulesQueryKey() }),
    },
  )

  if (rulesQuery.isError) {
    return <ErrorNotice error={rulesQuery.error} />
  }
  if (!rulesQuery.data) {
    return <LoadingRegion />
  }

  const close = () => setDialog(null)

  return (
    <div className={stackCss}>
      <p>{t("account-forms-rules-description")}</p>
      <div className={toolbarCss}>
        <Button
          variant="primary"
          size="medium"
          onClick={() => setDialog({ type: "edit", rule: null })}
        >
          {t("account-forms-rule-add")}
        </Button>
      </div>
      <Table
        caption={t("account-forms-rules-title")}
        density={DENSITY_COMPACT}
        rows={rulesQuery.data}
        rowKey={(rule) => rule.id}
        emptyState={t("account-forms-rules-empty")}
        columns={[
          { header: t("label-name"), cell: (rule) => rule.name, breakAnywhere: true },
          {
            header: t("account-forms-column-matches"),
            cell: (rule) =>
              matcherSummary(t, rule) ?? <span className={codeCss}>{rule.expression}</span>,
          },
          {
            header: t("account-forms-column-outcome"),
            cell: (rule) => outcomeLabel(t, rule.outcome),
          },
          { header: t("account-forms-column-enabled"), cell: (rule) => yesNo(t, rule.enabled) },
          {
            header: t("account-forms-column-log-only"),
            cell: (rule) => yesNo(t, rule.log_only),
          },
          {
            header: t("label-actions"),
            cell: (rule) => (
              <div className={toolbarCss}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setDialog({ type: "edit", rule })}
                >
                  {t("edit")}
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setDialog({ type: "versions", rule })}
                >
                  {t("account-forms-rule-versions-button")}
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  onClick={() => setDialog({ type: "delete", rule })}
                >
                  {t("button-text-delete")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      {dialog?.type === "edit" && (
        <RuleFormDialog key={dialog.rule?.id ?? "new"} existing={dialog.rule} onClose={close} />
      )}
      {dialog?.type === "versions" && <RuleVersionsDialog rule={dialog.rule} onClose={close} />}
      <ConfirmDialog
        open={dialog?.type === "delete"}
        onClose={close}
        title={t("account-forms-rule-delete-title")}
        description={t("account-forms-rule-delete-description", {
          name: dialog?.type === "delete" ? dialog.rule.name : "",
        })}
        confirmLabel={t("button-text-delete")}
        isDestructive
        onConfirm={async () => {
          if (dialog?.type === "delete") {
            await remove.mutateAsync({ path: { id: dialog.rule.id } })
            close()
          }
        }}
      />
    </div>
  )
}

export default RulesSection
