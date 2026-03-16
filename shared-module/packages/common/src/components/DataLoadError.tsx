"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import Button from "./Button"
import ErrorBanner from "./ErrorBanner"

export interface DataLoadErrorProps {
  onRetry: () => void | Promise<void>
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  buttonSize?: React.ComponentProps<typeof Button>["size"]
}

/**
 * Renders a generic data load error with a retry button.
 */
const DataLoadError: React.FC<React.PropsWithChildren<DataLoadErrorProps>> = ({
  onRetry,
  buttonVariant = "primary",
  buttonSize = "medium",
}) => {
  const { t } = useTranslation()

  return (
    <div>
      <ErrorBanner variant={"readOnly"} error={t("label-error-loading")} />
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={() => {
          void onRetry()
        }}
      >
        {t("button-text-try-again")}
      </Button>
    </div>
  )
}

export default DataLoadError
