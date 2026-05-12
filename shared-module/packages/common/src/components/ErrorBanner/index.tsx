"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { normalizeErrorForDisplay } from "../../errors/normalizeErrorForDisplay"
import { resolveErrorDisplayCopy } from "../../errors/resolveErrorDisplayCopy"

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
  const normalized = normalizeErrorForDisplay(unknownError, t)
  const displayCopy = resolveErrorDisplayCopy(normalized, t)
  const parsed = parseError(unknownError, t("error-title"), t)
  const statusLine =
    parsed.status !== null && parsed.status !== undefined
      ? t("error-status", { status: parsed.status } as never)
      : null
  const typeLine = parsed.type ? t("error-type", { type: parsed.type } as never) : null
  const messageKeyLine = parsed.messageKey
    ? t("error-message-key-line", { messageKey: parsed.messageKey })
    : null
  const codeLine =
    parsed.code && parsed.code !== parsed.type
      ? t("error-code", { code: parsed.code } as never)
      : null
  const hasTechnicalDetails =
    parsed.technicalDetails?.method ||
    parsed.technicalDetails?.url ||
    parsed.technicalDetails?.detail ||
    parsed.technicalDetails?.stack ||
    parsed.technicalDetails?.raw !== undefined

  return (
    <BannerWrapper compact={compact} isFrontendCrash={isFrontendCrash} role="alert">
      <Content compact={compact}>
        <Text compact={compact}>
          <h2>{displayCopy.title}</h2>
          {contextMessage && <p>{contextMessage}</p>}
          {displayCopy.message && <p>{displayCopy.message}</p>}
          {!!parsed.issues?.length && (
            <ul>
              {parsed.issues.map((issue, index) => (
                <li key={`${issue.path ?? "issue"}-${index}`}>
                  {parsed.messageKey === "response_validation_error"
                    ? t("error-zod-issue-prefix", {
                        path: issue.path ?? "",
                        message: issue.message,
                        defaultValue: "Validation issue at {{path}}: {{message}}",
                      })
                    : `${issue.path ? `${issue.path}: ` : ""}${issue.message}`}
                </li>
              ))}
            </ul>
          )}
        </Text>
        {(hasTechnicalDetails ||
          statusLine ||
          typeLine ||
          messageKeyLine ||
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
                      text={t("error-request-id", {
                        requestId: parsed.requestId,
                      } as never)}
                    />
                  </li>
                )}
                {parsed.retryAfterSeconds !== null && parsed.retryAfterSeconds !== undefined && (
                  <li>
                    <SourceBlock
                      text={t("error-retry-after", {
                        seconds: parsed.retryAfterSeconds,
                      } as never)}
                    />
                  </li>
                )}
                {typeLine && (
                  <li>
                    <SourceBlock text={typeLine} />
                  </li>
                )}
                {messageKeyLine && (
                  <li>
                    <SourceBlock text={messageKeyLine} />
                  </li>
                )}
                {codeLine && (
                  <li>
                    <SourceBlock text={codeLine} />
                  </li>
                )}
                {parsed.technicalDetails?.method && (
                  <li>
                    <SourceBlock
                      text={t("error-source-method", {
                        method: parsed.technicalDetails.method,
                      } as never)}
                    />
                  </li>
                )}
                {parsed.technicalDetails?.url && (
                  <li>
                    <SourceBlock
                      text={t("error-source-url", {
                        url: parsed.technicalDetails.url,
                      } as never)}
                    />
                  </li>
                )}
                {parsed.technicalDetails?.detail && (
                  <li>
                    <SourceBlock text={parsed.technicalDetails.detail} />
                  </li>
                )}
                {parsed.message && (
                  <li>
                    <SourceBlock text={parsed.message} />
                  </li>
                )}
                {parsed.technicalDetails?.stack && (
                  <li>
                    <SourceBlock text={parsed.technicalDetails.stack} />
                  </li>
                )}
                {parsed.technicalDetails?.raw !== undefined && (
                  <li>
                    <SourceBlock text={parsed.technicalDetails.raw} />
                  </li>
                )}
              </ul>
              {!hasTechnicalDetails && parsed.sourceData !== undefined && (
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
