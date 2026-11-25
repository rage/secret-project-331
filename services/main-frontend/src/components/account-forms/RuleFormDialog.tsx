"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createAccountFormRuleMutation,
  dryRunAccountFormRuleMutation,
  getAccountFormRulesQueryKey,
  updateAccountFormRuleMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  AccountFormListKind,
  AccountFormOutcome,
  AccountFormRule,
  AccountFormRuleUpdate,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  Button,
  Checkbox,
  DescriptionList,
  Dialog,
  ErrorNotice,
  Select,
  TextArea,
  TextField,
} from "@/shared-module/components"

import DecisionsTable from "./DecisionsTable"
import {
  ACCOUNT_FORM_LIST_KINDS,
  ACCOUNT_FORM_OUTCOMES,
  listKindLabel,
  outcomeLabel,
  stackCss,
} from "./shared"

const DEFAULT_OUTCOME: AccountFormOutcome = "drop"
const EXPRESSION = "expression"

type Matcher = typeof EXPRESSION | AccountFormListKind

interface Fields {
  name: string
  description: string
  matcher: Matcher
  expression: string
  /** One entry per line. */
  entries: string
  outcome: AccountFormOutcome
  enabled: boolean
  log_only: boolean
}

function toFields(rule: AccountFormRule | null): Fields {
  return {
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    matcher: rule?.list_kind ?? EXPRESSION,
    expression: rule?.expression ?? "",
    entries: rule?.list_entries.join("\n") ?? "",
    outcome: rule?.outcome ?? DEFAULT_OUTCOME,
    enabled: rule?.enabled ?? true,
    log_only: rule?.log_only ?? true,
  }
}

/** The matcher as the API takes it: an expression, or a list kind with its entries. */
function toMatcher(fields: Pick<Fields, "matcher" | "expression" | "entries">) {
  if (fields.matcher === EXPRESSION) {
    return { expression: fields.expression, list_kind: null, list_entries: [] }
  }
  return {
    expression: null,
    list_kind: fields.matcher,
    list_entries: fields.entries
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ""),
  }
}

interface RuleFormDialogProps {
  /** The rule to edit, or `null` to create one. */
  existing: AccountFormRule | null
  onClose: () => void
}

/** Create or edit form for a rule, with a dry run of its matcher on the log. */
const RuleFormDialog: React.FC<RuleFormDialogProps> = ({ existing, onClose }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { control, handleSubmit, getValues, watch } = useForm<Fields>({
    defaultValues: toFields(existing),
  })
  const [matcher, expression, entries] = watch(["matcher", "expression", "entries"])

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: getAccountFormRulesQueryKey() })
    onClose()
  }
  const create = useToastMutationOptions(
    createAccountFormRuleMutation(),
    { notify: true, method: "POST" },
    { onSuccess },
  )
  const update = useToastMutationOptions(
    updateAccountFormRuleMutation(),
    { notify: true, method: "PUT" },
    { onSuccess },
  )
  const dryRun = useMutation(dryRunAccountFormRuleMutation())
  const { reset: resetDryRun } = dryRun
  const dryRunGeneration = useRef(0)

  useEffect(() => {
    dryRunGeneration.current += 1
    resetDryRun()
  }, [matcher, expression, entries, resetDryRun])

  const startDryRun = () => {
    const generation = dryRunGeneration.current
    dryRun.mutate(
      { body: toMatcher(getValues()) },
      {
        onSuccess: () => {
          if (generation !== dryRunGeneration.current) {
            resetDryRun()
          }
        },
      },
    )
  }

  const submit = handleSubmit((fields) => {
    const body: AccountFormRuleUpdate = {
      name: fields.name.trim(),
      description: fields.description,
      ...toMatcher(fields),
      outcome: fields.outcome,
      enabled: fields.enabled,
      log_only: fields.log_only,
    }
    if (existing) {
      update.mutate({ path: { id: existing.id }, body })
    } else {
      create.mutate({ body })
    }
  })

  const result = dryRun.data

  return (
    <Dialog
      open
      onClose={onClose}
      size="wide"
      title={existing ? t("account-forms-rule-edit") : t("account-forms-rule-add")}
      actions={[
        { label: t("button-text-cancel"), variant: "secondary", onPress: onClose },
        {
          label: t("button-text-save"),
          variant: "primary",
          isLoading: create.isPending || update.isPending,
          onPress: () => void submit(),
        },
      ]}
    >
      <form onSubmit={submit} className={stackCss} noValidate>
        <TextField
          name="name"
          control={control}
          label={t("label-name")}
          rules={{ required: t("required-field") }}
        />
        <TextArea
          name="description"
          control={control}
          label={t("account-forms-rule-description")}
          rows={2}
        />
        <Select
          name="matcher"
          control={control}
          label={t("account-forms-rule-matcher")}
          options={[
            { value: EXPRESSION, label: t("account-forms-rule-matcher-expression") },
            ...ACCOUNT_FORM_LIST_KINDS.map((value) => ({
              value,
              label: listKindLabel(t, value),
            })),
          ]}
        />
        {matcher === EXPRESSION ? (
          <TextArea
            key={EXPRESSION}
            name="expression"
            control={control}
            label={t("account-forms-rule-expression")}
            description={t("account-forms-rule-expression-description")}
            rows={5}
            rules={{ required: t("required-field") }}
          />
        ) : (
          <TextArea
            key={matcher}
            name="entries"
            control={control}
            label={t("account-forms-rule-entries")}
            description={t("account-forms-rule-entries-description")}
            rows={5}
            rules={{ required: t("required-field") }}
          />
        )}
        <div>
          <Button
            variant="secondary"
            size="medium"
            isLoading={dryRun.isPending}
            onClick={startDryRun}
          >
            {t("account-forms-dry-run-button")}
          </Button>
        </div>
        {dryRun.isError && <ErrorNotice error={dryRun.error} />}
        {result && (
          <>
            <DescriptionList
              items={[
                { label: t("account-forms-dry-run-evaluated"), value: result.evaluated },
                { label: t("account-forms-dry-run-matched"), value: result.matched },
                {
                  label: t("account-forms-dry-run-errors"),
                  value: result.errors,
                  ...includeIf(result.first_error, { secondary: result.first_error }),
                },
              ]}
            />
            {result.examples.length > 0 && (
              <DecisionsTable
                decisions={result.examples}
                caption={t("account-forms-dry-run-examples")}
              />
            )}
          </>
        )}
        <Select
          name="outcome"
          control={control}
          label={t("account-forms-column-outcome")}
          description={t("account-forms-rule-outcome-description")}
          options={ACCOUNT_FORM_OUTCOMES.map((value) => ({ value, label: outcomeLabel(t, value) }))}
        />
        <Checkbox name="enabled" control={control} label={t("account-forms-column-enabled")} />
        <Checkbox
          name="log_only"
          control={control}
          label={t("account-forms-column-log-only")}
          description={t("account-forms-rule-log-only-description")}
        />
      </form>
    </Dialog>
  )
}

export default RuleFormDialog
