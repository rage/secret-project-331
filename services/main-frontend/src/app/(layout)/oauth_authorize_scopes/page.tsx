"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  approveOauthConsentMutation,
  denyOauthConsentMutation,
  getOauthConsentInfoOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { ConsentInfo, ConsentQuery } from "@/generated/api/types.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { fontWeights, monospaceFont } from "@/shared-module/common/styles"
import {
  Button,
  Checkbox,
  DescriptionList,
  type DescriptionListItem,
  Infobox,
  QueryResult,
  TONE,
} from "@/shared-module/components"
import { getOauthScopeDescriptions } from "@/utils/oauthScopeDescriptions"

interface ConsentFormValues {
  approved: boolean[]
}

const DetailValue: React.FC<{ "data-testid": string; children: string }> = ({
  "data-testid": testId,
  children,
}) => (
  <span
    className={css`
      font-family: ${monospaceFont};
    `}
    data-testid={testId}
  >
    {children}
  </span>
)

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

  const optionalDetails: (DescriptionListItem | false | null | undefined)[] = [
    consentInfo.client_uri
      ? {
          label: t("oauth-consent-client-website"),
          value: (
            <DetailValue data-testid="oauth-consent-client-uri">
              {consentInfo.client_uri}
            </DetailValue>
          ),
        }
      : null,
    consentInfo.is_metadata_document_client && {
      label: t("oauth-consent-client-id"),
      value: <DetailValue data-testid="oauth-consent-client-id">{request.client_id}</DetailValue>,
    },
    {
      label: t("oauth-consent-redirect-uri"),
      value: (
        <DetailValue data-testid="oauth-consent-redirect-uri">{request.redirect_uri}</DetailValue>
      ),
    },
  ]
  const details = optionalDetails.filter((item): item is DescriptionListItem => Boolean(item))

  const redirectOnSuccess = {
    onSuccess: (res: { redirect_uri?: string | null }) => {
      if (res.redirect_uri) {
        window.location.assign(res.redirect_uri)
      }
    },
  }
  const approveMutation = useToastMutationOptions(
    approveOauthConsentMutation(),
    { notify: true, method: "POST" },
    redirectOnSuccess,
  )
  const denyMutation = useToastMutationOptions(
    denyOauthConsentMutation(),
    { notify: true, method: "POST" },
    redirectOnSuccess,
  )

  const onApprove = handleSubmit(async (values) => {
    const approvedScopes = consentInfo.scopes
      .filter((scope, index) => scope.is_required || values.approved[index])
      .map((scope) => scope.scope)
    await approveMutation.mutateAsync({ body: { ...request, scope: approvedScopes.join(" ") } })
  })
  const onDeny = async () => {
    await denyMutation.mutateAsync({
      body: {
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        state: request.state,
      },
    })
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
      <h2
        className={css`
          margin: 0;
        `}
      >
        {consentInfo.client_name}
      </h2>

      <p
        className={css`
          margin: 0;
        `}
      >
        {t("oauth-application-requesting-access")}
      </p>

      {/* oxlint-disable-next-line i18next/no-literal-string */}
      <DescriptionList layout="stacked" items={details} />

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

  const optionalParam = (name: string) => searchParams.get(name) || null
  const request: Omit<ConsentQuery, "scope"> = {
    client_id: searchParams.get("client_id") ?? "",
    redirect_uri: searchParams.get("redirect_uri") ?? "",
    response_type: searchParams.get("response_type") ?? "",
    state: searchParams.get("state") ?? "",
    nonce: searchParams.get("nonce") ?? "",
    // oxlint-disable-next-line i18next/no-literal-string
    code_challenge: optionalParam("code_challenge"),
    // oxlint-disable-next-line i18next/no-literal-string
    code_challenge_method: optionalParam("code_challenge_method"),
    // oxlint-disable-next-line i18next/no-literal-string
    resource: optionalParam("resource"),
  }
  const consentInfoQuery = useQuery(
    getOauthConsentInfoOptions({
      query: {
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        scope: searchParams.get("scope") ?? "",
      },
    }),
  )

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
