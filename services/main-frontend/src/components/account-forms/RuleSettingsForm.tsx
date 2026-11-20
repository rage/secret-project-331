"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getAccountFormSettingsOptions,
  getAccountFormSettingsQueryKey,
  updateAccountFormSettingsMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { AccountFormSettings } from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { Button, ErrorNotice, LoadingRegion, Switch } from "@/shared-module/components"

import { stackCss } from "./shared"

const SettingsForm: React.FC<{ settings: AccountFormSettings }> = ({ settings }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { control, handleSubmit } = useForm<AccountFormSettings>({ defaultValues: settings })
  const save = useToastMutationOptions(
    updateAccountFormSettingsMutation(),
    { notify: true, method: "PUT" },
    {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getAccountFormSettingsQueryKey() }),
    },
  )

  return (
    <form
      onSubmit={handleSubmit((fields) => save.mutate({ body: fields }))}
      className={stackCss}
      noValidate
    >
      <Switch
        name="rules_log_only"
        control={control}
        label={t("account-forms-setting-rules-log-only")}
        description={t("account-forms-setting-rules-log-only-description")}
      />
      <div>
        <Button type="submit" variant="primary" size="medium" disabled={save.isPending}>
          {t("button-text-save")}
        </Button>
      </div>
    </form>
  )
}

/** The switch that makes every rule log-only. */
const RuleSettingsForm: React.FC = () => {
  const settingsQuery = useQuery(getAccountFormSettingsOptions())
  if (settingsQuery.isError) {
    return <ErrorNotice error={settingsQuery.error} />
  }
  if (!settingsQuery.data) {
    return <LoadingRegion />
  }
  return <SettingsForm settings={settingsQuery.data} />
}

export default RuleSettingsForm
