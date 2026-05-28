"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ectsEmailUnsubscribe } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EctsUnsubscribePage: React.FC = () => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  // eslint-disable-next-line i18next/no-literal-string
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line i18next/no-literal-string
      setStatus("error")
      setError(new Error(t("error-missing-unsubscribe-token")))
      return
    }
    ectsEmailUnsubscribe({ query: { token } })
      // eslint-disable-next-line i18next/no-literal-string
      .then(() => setStatus("success"))
      .catch((err) => {
        // eslint-disable-next-line i18next/no-literal-string
        setStatus("error")
        setError(err)
      })
  }, [t, token])

  if (status === "loading") {
    return <Spinner variant={"medium"} />
  }

  if (status === "error") {
    return <ErrorBanner variant={"readOnly"} error={error} />
  }

  return (
    <div
      className={css`
        background-color: ${baseTheme.colors.green[100]};
        padding: 3rem;
        margin-bottom: 1rem;

        h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }

        p {
          font-size: 1rem;
          margin-bottom: 1.5rem;
        }
      `}
    >
      <h1>{t("ects-unsubscribe-success-heading")}</h1>
      <p>{t("ects-unsubscribe-success-body")}</p>
      <Link href="/">
        <Button size="medium" variant="primary">
          {t("home-page")}
        </Button>
      </Link>
    </div>
  )
}

export default withErrorBoundary(EctsUnsubscribePage)
