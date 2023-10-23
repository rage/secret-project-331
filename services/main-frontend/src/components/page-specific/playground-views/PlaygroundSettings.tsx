import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { BellXmark, CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DEFAULT_SERVICE_INFO_URL, PlaygroundSettings } from "../../../pages/playground-tabs"
import { ExerciseServiceInfoApi } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import DebugModal from "../../../shared-module/components/DebugModal"
import CheckBox from "../../../shared-module/components/InputFields/CheckBox"
import TextField from "../../../shared-module/components/InputFields/TextField"
import { baseTheme } from "../../../shared-module/styles"

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
  const url = settingsForm.watch("url")
  return (
    <div
      className={css`
        padding: 1rem;
      `}
    >
      <div>
        <TextField label={t("service-info-url")} {...settingsForm.register("url")} />
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
        <TextField
          placeholder={t("label-width")}
          label={t("label-width")}
          {...settingsForm.register("width")}
        />
        <CheckBox
          label={t("show-iframe-borders")}
          {...settingsForm.register("showIframeBorders")}
        />
        <CheckBox label={t("disable-sandbox")} {...settingsForm.register("disableSandbox")} />
        <TextField
          placeholder={t("label-pseudonymous-user-id")}
          label={t("label-pseudonymous-user-id")}
          {...settingsForm.register("pseudonymousUserId")}
        />
        <CheckBox label={t("button-text-signed-in")} {...settingsForm.register("signedIn")} />
      </div>
    </div>
  )
}

export default PlayGroundSettings
