"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import { BellXmark, CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { PlaygroundSettings } from "@/app/(layout)/playground-tabs/page"
import { DEFAULT_SERVICE_INFO_URL } from "@/constants/playground"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Checkbox, TextField } from "@/shared-module/components"
import type { ExerciseServiceInfoApi } from "@/utils/playgroundSchemas"

interface PlayGroundSettingsProps {
  settingsForm: UseFormReturn<PlaygroundSettings>
  serviceInfoQuery: UseQueryResult<ExerciseServiceInfoApi, unknown>
  isValidServiceInfo: boolean
}

const PlayGroundSettings: React.FC<PlayGroundSettingsProps> = ({
  settingsForm,
  serviceInfoQuery,
  isValidServiceInfo,
}) => {
  const { t } = useTranslation()
  const { control } = settingsForm
  const url = settingsForm.watch("url")
  return (
    <div
      className={css`
        padding: 1rem;
      `}
    >
      <div>
        <TextField name="url" control={control} label={t("service-info-url")} />
        {serviceInfoQuery.isError && t("error-fetching-service-info")}
        {!serviceInfoQuery.isLoading && (
          <div
            className={css`
              margin-top: -0.7rem;
              margin-bottom: 0.2rem;
              padding-left: 1rem;
            `}
          >
            {isValidServiceInfo ? (
              <CheckCircle color={baseTheme.colors.green[400]} size={16} />
            ) : (
              <BellXmark color={baseTheme.colors.red[500]} size={16} />
            )}

            <span
              className={css`
                margin: 0 0.5rem;
              `}
            >
              {isValidServiceInfo ? t("valid-service-info") : t("invalid-service-info")}
            </span>
            <DebugModal data={serviceInfoQuery.data} buttonSize="small" />
            {url !== DEFAULT_SERVICE_INFO_URL && (
              <Button
                variant={"secondary"}
                size={"small"}
                className={css`
                  margin-left: 0.5rem;
                `}
                onClick={() => {
                  settingsForm.setValue("url", DEFAULT_SERVICE_INFO_URL)
                }}
              >
                {t("button-text-reset-url")}
              </Button>
            )}
          </div>
        )}
      </div>
      <div>
        <TextField name="width" control={control} label={t("label-width")} />
        <Checkbox name="showIframeBorders" control={control} label={t("show-iframe-borders")} />
        <Checkbox name="disableSandbox" control={control} label={t("disable-sandbox")} />
        <TextField
          name="pseudonymousUserId"
          control={control}
          label={t("label-pseudonymous-user-id")}
        />
        <Checkbox name="signedIn" control={control} label={t("button-text-signed-in")} />
      </div>
    </div>
  )
}

export default withErrorBoundary(PlayGroundSettings)
