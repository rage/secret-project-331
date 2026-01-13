"use client"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Spinner from "../Spinner"

import SourceBlock from "./SourceBlock"
import { ParsedError, parseError } from "./parseError"
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

  const [parsed, setParsed] = useState<ParsedError | null>(null)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      if (unknownError === undefined) {
        throw new Error("Invalid input")
      }
      const result = await parseError(unknownError, t("error-title"))
      if (isMounted) {
        setParsed(result)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [unknownError, t])

  if (parsed === null) {
    return <Spinner variant="medium" />
  }

  return (
    <BannerWrapper compact={compact} isFrontendCrash={isFrontendCrash}>
      <Content compact={compact}>
        <Text compact={compact}>
          <h2>
            {parsed.status !== undefined ? (
              <>
                {t("error-title")} {parsed.status}: {parsed.title}
              </>
            ) : (
              <>
                {t("error-title")}: {parsed.title}
              </>
            )}
          </h2>
          {contextMessage && <p>{contextMessage}</p>}
          {parsed.message && <p>{parsed.message}</p>}
        </Text>
        {parsed.sourceData !== undefined && (
          <DetailTag>
            <details>
              <summary>{t("show-error-source")}</summary>
              <ul>
                <li>
                  <SourceBlock text={parsed.sourceData} />
                </li>
              </ul>
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
