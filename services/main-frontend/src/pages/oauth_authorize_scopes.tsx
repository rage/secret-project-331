import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  postOAuthConsent as approveConsent,
  postOAuthDeny as denyConsent,
} from "@/services/backend/users"
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
    code_challenge: router.query.code_challenge ? String(router.query.code_challenge) : null,
    code_challenge_method: router.query.code_challenge_method
      ? String(router.query.code_challenge_method)
      : null,
  }

  const scopes = query.scope.split(" ").filter(Boolean)

  const scopeDescriptions: Record<string, string> = {
    openid: t("oauth-scope-description-openid"),
    email: t("oauth-scope-description-email"),
    profile: t("oauth-scope-description-profile"),
    offline_access: t("oauth-scope-description-offline-access"),
  }

  const onApprove = async () => {
    const res = await approveConsent(query)
    if (res.redirect_uri) {
      window.location.assign(res.redirect_uri)
    }
  }
  const onDeny = async () => {
    const res = await denyConsent({
      client_id: query.client_id,
      redirect_uri: query.redirect_uri,
      state: query.state,
    })
    if (res.redirect_uri) {
      window.location.assign(res.redirect_uri)
    }
  }

  return (
    <section
      aria-label={t("oauth-application-requesting-access")}
      data-testid="oauth-consent-form"
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
      <h2> {query.client_id}</h2>

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
        <Button
          variant="primary"
          onClick={onApprove}
          size="large"
          aria-label={t("approve")}
          data-testid="oauth-consent-approve-button"
        >
          {t("approve")}
        </Button>
        <Button
          onClick={onDeny}
          variant="reject"
          size="large"
          aria-label={t("button-text-cancel")}
          data-testid="oauth-consent-deny-button"
        >
          {t("button-text-cancel")}
        </Button>
      </div>
    </section>
  )
}
