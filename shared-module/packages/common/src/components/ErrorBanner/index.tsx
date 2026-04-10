"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import SourceBlock from "./SourceBlock"
import { parseError } from "./parseError"
import { BannerWrapper, Content, DetailTag, Text } from "./styles"

export interface BannerExtraProps {
  variant?: "text" | "link" | "readOnly" | "frontendCrash"
  error: unknown | string
  contextMessage?: React.ReactNode
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const ErrorBanner: React.FC<React.PropsWithChildren<BannerProps>> = (props) => {
  const { t } = useTranslation()
  const { variant: __variant = "text", error: unknownError, contextMessage } = props
  const compact = __variant === "frontendCrash"
  const isFrontendCrash = __variant === "frontendCrash"
  const parsed = parseError(unknownError, t("error-title"))
  const translatedTitle = parsed.messageKey
    ? t(`error-message-key.${parsed.messageKey}.title`, { defaultValue: parsed.title })
    : parsed.title
  const translatedMessage = parsed.messageKey
    ? t(`error-message-key.${parsed.messageKey}.message`, { defaultValue: parsed.message ?? "" })
    : parsed.message
  const statusLine =
    parsed.status !== null && parsed.status !== undefined
      ? t("error-status", "Status: {{status}}", { status: parsed.status })
      : null
  const typeLine = parsed.type ? t("error-type", "Type: {{type}}", { type: parsed.type }) : null
  const codeLine =
    parsed.code && parsed.code !== parsed.type
      ? t("error-code", "Code: {{code}}", { code: parsed.code })
      : null

  return (
    <BannerWrapper compact={compact} isFrontendCrash={isFrontendCrash} role="alert">
      <Content compact={compact}>
        <Text compact={compact}>
          <h2>{translatedTitle}</h2>
          {contextMessage && <p>{contextMessage}</p>}
          {translatedMessage && <p>{translatedMessage}</p>}
          {!!parsed.issues?.length && (
            <ul>
              {parsed.issues.map((issue, index) => (
                <li key={`${issue.path ?? "issue"}-${index}`}>
                  {issue.path ? `${issue.path}: ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </Text>
        {(parsed.sourceData !== undefined ||
          statusLine ||
          typeLine ||
          codeLine ||
          parsed.requestId ||
          (parsed.retryAfterSeconds !== null && parsed.retryAfterSeconds !== undefined)) && (
          <DetailTag>
            <details>
              <summary>{t("show-error-source")}</summary>
              <ul>
                {statusLine && (
                  <li>
                    <SourceBlock text={statusLine} />
                  </li>
                )}
                {parsed.requestId && (
                  <li>
                    <SourceBlock
                      text={t("error-request-id", "Request ID: {{requestId}}", {
                        requestId: parsed.requestId,
                      })}
                    />
                  </li>
                )}
                {parsed.retryAfterSeconds !== null && parsed.retryAfterSeconds !== undefined && (
                  <li>
                    <SourceBlock
                      text={t("error-retry-after", "Retry after: {{seconds}}s", {
                        seconds: parsed.retryAfterSeconds,
                      })}
                    />
                  </li>
                )}
                {typeLine && (
                  <li>
                    <SourceBlock text={typeLine} />
                  </li>
                )}
                {codeLine && (
                  <li>
                    <SourceBlock text={codeLine} />
                  </li>
                )}
              </ul>
              {parsed.sourceData !== undefined && (
                <ul>
                  <li>
                    <SourceBlock text={parsed.sourceData} />
                  </li>
                </ul>
              )}
            </details>
          </DetailTag>
        )}
        {parsed.linkBlockId && (
          <Text>
            <a href={`${window.location.href.replace(location.hash, "")}#${parsed.linkBlockId}`}>
              {t("go-to-error")}
            </a>
          </Text>
        )}
      </Content>
    </BannerWrapper>
  )
}

export default ErrorBanner
