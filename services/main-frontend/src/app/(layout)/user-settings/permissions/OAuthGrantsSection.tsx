"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LinkChain } from "@vectopus/atlas-icons-react"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  getOauthGrantsOptions,
  getOauthGrantsQueryKey,
  revokeOauthGrantMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { OAuthGrant } from "@/generated/api/types.generated"
import MaskOverThisInSystemTests from "@/shared-module/common/components/system-tests/MaskOverThisInSystemTests"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  MIDDLE_DOT,
  QueryResult,
} from "@/shared-module/components"
import { settingsCardCss } from "@/styles/sharedStyles"

const listCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`

const metaCss = css`
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[500]};
`

/** The applications and AI agents the user has given access to their account, with revoke. */
const OAuthGrantsSection: React.FC = () => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()
  const [grantToRevoke, setGrantToRevoke] = useState<OAuthGrant | null>(null)

  const grantsQuery = useQuery({
    ...getOauthGrantsOptions(),
    enabled: loginStateContext.signedIn === true,
  })
  const revokeMutation = useToastMutationOptions(
    revokeOauthGrantMutation(),
    { notify: true, method: "DELETE" },
    {
      onSuccess: async () => {
        setGrantToRevoke(null)
        await queryClient.invalidateQueries({ queryKey: getOauthGrantsQueryKey() })
      },
    },
  )

  return (
    <div data-testid="authorized-applications-section" className={settingsCardCss}>
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid ${baseTheme.colors.gray[100]};
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: ${baseTheme.colors.green[75]};
            border-radius: 6px;
            flex-shrink: 0;
          `}
        >
          <LinkChain
            size={16}
            className={css`
              color: ${baseTheme.colors.green[700]};
            `}
          />
        </div>
        <h2
          className={css`
            font-size: 1.0625rem;
            font-weight: ${fontWeights.semibold};
            color: ${baseTheme.colors.gray[700]};
            margin: 0;
          `}
        >
          {t("user-settings-authorized-apps")}
        </h2>
      </div>

      {loginStateContext.signedIn === true && (
        <QueryResult
          query={grantsQuery}
          emptyFallback={
            <EmptyState
              title={t("no-authorized-applications")}
              data-testid="authorized-applications-list"
            />
          }
        >
          {(grants) => (
            <div data-testid="authorized-applications-list" className={listCss}>
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  data-testid={`authorized-app-${grant.id}`}
                  className={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.875rem 1rem;
                    background: ${baseTheme.colors.gray[50]};
                    border: 1px solid ${baseTheme.colors.gray[100]};
                    border-radius: 8px;
                  `}
                >
                  <div
                    className={css`
                      min-width: 0;
                    `}
                  >
                    <div
                      className={css`
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        margin-bottom: 0.125rem;
                      `}
                    >
                      <span
                        data-testid={`app-name-${grant.id}`}
                        className={css`
                          font-weight: 500;
                          color: ${baseTheme.colors.gray[700]};
                          font-size: 0.9375rem;
                        `}
                      >
                        {grant.client_name}
                      </span>
                      {grant.is_metadata_document_client && (
                        <Badge size="compact">{t("oauth-grant-ai-agent")}</Badge>
                      )}
                    </div>
                    {grant.client_uri && (
                      <div
                        className={cx(
                          metaCss,
                          css`
                            overflow-wrap: anywhere;
                          `,
                        )}
                      >
                        {grant.client_uri}
                      </div>
                    )}
                    <div data-testid={`app-scopes-${grant.id}`} className={metaCss}>
                      {grant.scopes.join(", ")}
                    </div>
                    <div data-testid={`app-usage-${grant.id}`} className={metaCss}>
                      <MaskOverThisInSystemTests>
                        {t("oauth-grant-granted-at", { time: dateToString(grant.granted_at) })}
                        {MIDDLE_DOT}
                        {grant.last_used_at
                          ? t("oauth-grant-last-used-at", {
                              time: dateToString(grant.last_used_at),
                            })
                          : t("oauth-grant-never-used")}
                      </MaskOverThisInSystemTests>
                    </div>
                  </div>
                  <Button
                    data-testid={`revoke-app-${grant.id}`}
                    variant="tertiary"
                    size="small"
                    aria-label={t("oauth-grant-revoke-button-label", {
                      client: grant.client_name,
                    })}
                    onPress={() => setGrantToRevoke(grant)}
                  >
                    {t("revoke")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </QueryResult>
      )}

      <ConfirmDialog
        open={grantToRevoke !== null}
        onClose={() => setGrantToRevoke(null)}
        title={t("oauth-grant-revoke-title", { client: grantToRevoke?.client_name ?? "" })}
        description={t("oauth-grant-revoke-description")}
        confirmLabel={t("revoke")}
        // oxlint-disable-next-line i18next/no-literal-string
        confirmTestId="oauth-grant-revoke-confirm-button"
        isDestructive
        onConfirm={async () => {
          if (!grantToRevoke) {
            return
          }
          try {
            await revokeMutation.mutateAsync({ path: { grant_id: grantToRevoke.id } })
          } catch {
            // The mutation's error toast shows it.
          }
        }}
      />
    </div>
  )
}

export default OAuthGrantsSection
