import { css } from "@emotion/css"
import { useRouter } from "next/router"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

export default function ConsentPage() {
  const router = useRouter()
  const { t } = useTranslation("main-frontend")

  const scopeDescriptions: Record<string, string> = {
    openid: t("oauth-scope-description-openid"),
    email: t("oauth-scope-description-email"),
    profile: t("oauth-scope-description-profile"),
    offline_access: t("oauth-scope-description-offline-access"),
  }

  const {
    client_id = "",
    client_name = "Unknown Application",
    redirect_uri = "",
    scope = "",
    state = "",
    nonce = "",
    return_to = "",
  } = router.query

  const scopes = useMemo(() => {
    if (typeof scope === "string") {
      return scope.split(" ").filter(Boolean)
    }
    return []
  }, [scope])

  const handleApprove = () => {
    /* eslint-disable i18next/no-literal-string */
    const approveUrl =
      `/api/v0/main-frontend/oauth/consent?` +
      `client_id=${encodeURIComponent(String(client_id))}` +
      `&redirect_uri=${encodeURIComponent(String(redirect_uri))}` +
      `&scopes=${encodeURIComponent(scopes.join(" "))}` +
      `&state=${encodeURIComponent(String(state))}` +
      `&nonce=${encodeURIComponent(String(nonce))}` +
      `&return_to=${encodeURIComponent(String(return_to))}`
    /* eslint-enable i18next/no-literal-string */
    window.location.href = approveUrl
  }

  const handleDeny = () => {
    /* eslint-disable i18next/no-literal-string */
    const denyUrl =
      `/api/v0/main-frontend/oauth/consent/deny?` +
      `client_id=${encodeURIComponent(String(client_id))}` +
      `&redirect_uri=${encodeURIComponent(String(redirect_uri))}` +
      `&state=${encodeURIComponent(String(state))}`
    /* eslint-enable i18next/no-literal-string */

    window.location.href = denyUrl
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        max-width: 600px;
        margin: auto;
      `}
    >
      <h2>{client_name}</h2>
      <p>{t("oauth-application-requesting-access")}</p>

      <ul>
        {scopes.map((scope) => (
          <li key={scope}>
            <strong>{scope}</strong>:{" "}
            {scopeDescriptions[scope] || t("oauth-scope-description-no-description")}
          </li>
        ))}
      </ul>

      <div>
        <Button variant="primary" onClick={handleApprove} size="large">
          {t("approve")}
        </Button>
        <Button onClick={handleDeny} variant="reject" size="large">
          {t("button-text-cancel")}
        </Button>
      </div>
    </div>
  )
}
