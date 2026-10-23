"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getOauthConsentInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import { approveOauthConsent, denyOauthConsent } from "@/generated/api/sdk.generated"
import type { ConsentInfo, ConsentQuery } from "@/generated/api/types.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { Button, Checkbox, Infobox, QueryResult, TONE } from "@/shared-module/components"
import { getOauthScopeDescriptions } from "@/utils/oauthScopeDescriptions"

interface ConsentFormValues {
  approved: boolean[]
}

const detailLabelCss = css`
  font-size: 0.8125rem;
  font-weight: ${fontWeights.medium};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: ${baseTheme.colors.gray[500]};
  margin: 0;
`

const detailValueCss = css`
  margin: 0 0 0.75rem 0;
  overflow-wrap: anywhere;
  font-family: monospace;
`

interface ConsentFormProps {
  consentInfo: ConsentInfo
  request: Omit<ConsentQuery, "scope">
}

const ConsentForm: React.FC<ConsentFormProps> = ({ consentInfo, request }) => {
  const { t } = useTranslation("main-frontend")
  const scopeDescriptions = getOauthScopeDescriptions(t)
  const { control, handleSubmit, formState } = useForm<ConsentFormValues>({
    defaultValues: {
      approved: consentInfo.scopes.map(
        (scope) => scope.is_required || scope.is_checked_by_default || scope.was_previously_granted,
      ),
    },
  })

  const onApprove = handleSubmit(async (values) => {
    const approvedScopes = consentInfo.scopes
      .filter((scope, index) => scope.is_required || values.approved[index])
      .map((scope) => scope.scope)
    const res = await approveOauthConsent({
      body: { ...request, scope: approvedScopes.join(" ") },
    })
    if (res.redirect_uri) {
      window.location.assign(res.redirect_uri)
    }
  })
  const onDeny = async () => {
    const res = await denyOauthConsent({
      body: {
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        state: request.state,
      },
    })
    if (res.redirect_uri) {
      window.location.assign(res.redirect_uri)
    }
  }

  return (
    <form
      onSubmit={onApprove}
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        width: 100%;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
        `}
      >
        {consentInfo.logo_uri && (
          // oxlint-disable-next-line nextjs/no-img-element -- any host; next/image needs allow-listed ones
          <img
            src={consentInfo.logo_uri}
            alt=""
            width={40}
            height={40}
            className={css`
              border-radius: 6px;
              object-fit: contain;
            `}
          />
        )}
        <h2
          className={css`
            margin: 0;
          `}
        >
          {consentInfo.client_name}
        </h2>
      </div>

      <p
        className={css`
          margin: 0;
        `}
      >
        {t("oauth-application-requesting-access")}
      </p>

      <div>
        {consentInfo.client_uri && (
          <>
            <p className={detailLabelCss}>{t("oauth-consent-client-website")}</p>
            <p className={detailValueCss} data-testid="oauth-consent-client-uri">
              {consentInfo.client_uri}
            </p>
          </>
        )}
        {consentInfo.is_metadata_document_client && (
          <>
            <p className={detailLabelCss}>{t("oauth-consent-client-id")}</p>
            <p className={detailValueCss} data-testid="oauth-consent-client-id">
              {consentInfo.client_id}
            </p>
          </>
        )}
        <p className={detailLabelCss}>{t("oauth-consent-redirect-uri")}</p>
        <p className={detailValueCss} data-testid="oauth-consent-redirect-uri">
          {consentInfo.redirect_uri}
        </p>
      </div>

      {consentInfo.is_metadata_document_client && (
        <Infobox tone={TONE.INFO} data-testid="oauth-consent-agent-note">
          <p>{t("oauth-consent-any-name-note")}</p>
          {consentInfo.is_loopback_redirect && <p>{t("oauth-consent-loopback-note")}</p>}
        </Infobox>
      )}

      <fieldset
        className={css`
          border: none;
          margin: 0;
          padding: 0;
        `}
      >
        <legend
          className={css`
            font-weight: ${fontWeights.semibold};
            margin-bottom: 0.5rem;
          `}
        >
          {t("oauth-consent-choose-permissions")}
        </legend>
        <ul
          className={css`
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          `}
        >
          {consentInfo.scopes.map((scope, index) => (
            <li key={scope.scope} data-testid={`oauth-consent-scope-${scope.scope}`}>
              <Checkbox<ConsentFormValues>
                control={control}
                name={`approved.${index}`}
                isDisabled={scope.is_required}
                label={
                  <>
                    <strong>{scope.scope}</strong>:{" "}
                    {scopeDescriptions[scope.scope] || t("oauth-scope-description-no-description")}
                  </>
                }
                description={
                  scope.is_required
                    ? t("oauth-consent-scope-required")
                    : scope.was_previously_granted
                      ? t("oauth-consent-scope-previously-granted")
                      : undefined
                }
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <div
        className={css`
          display: flex;
          gap: 10px;
        `}
      >
        <Button
          type="submit"
          variant="primary"
          size="large"
          isLoading={formState.isSubmitting}
          data-testid="oauth-consent-approve-button"
        >
          {t("approve")}
        </Button>
        <Button
          onPress={onDeny}
          variant="danger"
          size="large"
          data-testid="oauth-consent-deny-button"
        >
          {t("button-text-cancel")}
        </Button>
      </div>
    </form>
  )
}

export default function ConsentPage() {
  const searchParams = useSearchParams()
  const { t } = useTranslation("main-frontend")
  usePageTitle(t("title-authorize-application"))

  const optionalParam = (name: string) => {
    const value = searchParams.get(name)
    return value ? String(value) : null
  }
  const request: Omit<ConsentQuery, "scope"> = {
    client_id: String(searchParams.get("client_id") ?? ""),
    redirect_uri: String(searchParams.get("redirect_uri") ?? ""),
    response_type: String(searchParams.get("response_type") ?? ""),
    state: String(searchParams.get("state") ?? ""),
    nonce: String(searchParams.get("nonce") ?? ""),
    // oxlint-disable-next-line i18next/no-literal-string
    code_challenge: optionalParam("code_challenge"),
    // oxlint-disable-next-line i18next/no-literal-string
    code_challenge_method: optionalParam("code_challenge_method"),
    // oxlint-disable-next-line i18next/no-literal-string
    resource: optionalParam("resource"),
  }
  const consentInfoQuery = useQuery({
    ...getOauthConsentInfoOptions({
      query: {
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        scope: String(searchParams.get("scope") ?? ""),
      },
    }),
  })

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
      <QueryResult query={consentInfoQuery}>
        {(consentInfo) => <ConsentForm consentInfo={consentInfo} request={request} />}
      </QueryResult>
    </section>
  )
}
