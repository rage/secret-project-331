import { css } from "@emotion/css"
import { useRouter } from "next/router"
import { useTranslation } from "react-i18next"

import Button from "@/shared-module/common/components/Button"

export default function ConsentPage() {
  const router = useRouter()
  const { t } = useTranslation("main-frontend")

  const query = {
    client_id: String(router.query.client_id ?? ""),
    client_name: String(router.query.client_name ?? ""),
    redirect_uri: String(router.query.redirect_uri ?? ""),
    response_type: String(router.query.response_type ?? ""),
    scope: String(router.query.scope ?? ""),
    state: String(router.query.state ?? ""),
    nonce: String(router.query.nonce ?? ""),
  }

  const scopes = query.scope.split(" ").filter(Boolean)

  const scopeDescriptions: Record<string, string> = {
    openid: t("oauth-scope-description-openid"),
    email: t("oauth-scope-description-email"),
    profile: t("oauth-scope-description-profile"),
    offline_access: t("oauth-scope-description-offline-access"),
  }

  const handleApprove = () => {
    const params = new URLSearchParams({
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      response_type: query.response_type,
      scopes: scopes.join(" "),
      state: query.state,
      nonce: query.nonce,
    })
    window.location.href = `/api/v0/main-frontend/oauth/consent?${params}`
  }

  const handleDeny = () => {
    const params = new URLSearchParams({
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      state: query.state,
    })
    window.location.href = `/api/v0/main-frontend/oauth/consent/deny?${params}`
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
      <h2>{query.client_name}</h2>
      <p>{t("oauth-application-requesting-access")}</p>

      <ul>
        {scopes.map((scope) => (
          <li key={scope}>
            <strong>{scope}</strong>:{" "}
            {scopeDescriptions[scope] || t("oauth-scope-description-no-description")}
          </li>
        ))}
      </ul>

      <div
        className={css`
          display: flex;
          gap: 10px;
        `}
      >
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
