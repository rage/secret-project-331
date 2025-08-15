import { css } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import { TFunction } from "i18next"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"

interface ErrorDisplayProps {
  error: Error
}

// Helper function to format error messages nicely
const formatErrorMessage = (
  error: Error,
  t: TFunction,
): { boldPart: string; normalPart: string; details: string[]; originalMessage: string } => {
  const originalMessage = error.message

  // Try to extract JSON from the error message
  const jsonMatch = originalMessage.match(/\{.*\}/)
  if (!jsonMatch) {
    return {
      boldPart: t("failed-to-send-message"),
      normalPart: `: ${originalMessage}`,
      details: [],
      originalMessage,
    }
  }

  try {
    const jsonStr = jsonMatch[0]
    const errorData = JSON.parse(jsonStr)

    const details: string[] = []
    let mainMessage = ""

    // Extract common error fields
    if (errorData.title) {
      details.push(t("error-type", { type: errorData.title }))
    }

    if (errorData.message) {
      // Try to parse nested error messages
      const nestedJsonMatch = errorData.message.match(/Error: (\{.*\})/)
      if (nestedJsonMatch) {
        try {
          const nestedError = JSON.parse(nestedJsonMatch[1])
          if (nestedError.error?.message) {
            mainMessage = nestedError.error.message
            details.push(t("error-issue", { issue: nestedError.error.message }))
          }
          if (nestedError.error?.requestid) {
            details.push(t("error-request-id", { requestId: nestedError.error.requestid }))
          }
        } catch {
          mainMessage = errorData.message
          details.push(t("error-message", { message: errorData.message }))
        }
      } else {
        mainMessage = errorData.message
        details.push(t("error-message", { message: errorData.message }))
      }
    }

    // Extract status from the original message if present and add to details only
    const statusMatch = originalMessage.match(/status (\d+)/i)
    if (statusMatch) {
      details.unshift(t("error-status", { status: statusMatch[1] }))
    }

    const boldPart = t("failed-to-send-message")
    const normalPart = mainMessage ? `: ${mainMessage}` : ""

    return {
      boldPart,
      normalPart,
      details: details.length > 0 ? details : [originalMessage],
      originalMessage,
    }
  } catch {
    return {
      boldPart: t("failed-to-send-message"),
      normalPart: `: ${originalMessage}`,
      details: [],
      originalMessage,
    }
  }
}

// Helper function to format the original error message for display
const formatOriginalErrorMessage = (originalMessage: string): string => {
  // Try to extract and format JSON from the error message
  const jsonMatch = originalMessage.match(/\{.*\}/)
  if (!jsonMatch) {
    return originalMessage
  }

  try {
    const jsonStr = jsonMatch[0]
    const parsed = JSON.parse(jsonStr)
    const formatted = JSON.stringify(parsed, null, 2)

    // Replace the JSON part in the original message with the formatted version
    // eslint-disable-next-line i18next/no-literal-string
    return originalMessage.replace(jsonMatch[0], `\n${formatted}`)
  } catch {
    return originalMessage
  }
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  const { t } = useTranslation()
  const [showDetails, setShowDetails] = useState(false)

  const formattedError = formatErrorMessage(error, t)
  const hasDetails = formattedError.details.length > 0

  return (
    <div
      className={css`
        margin: 16px 12px;
        border: 1px solid ${baseTheme.colors.red[300]};
        border-left: 4px solid ${baseTheme.colors.red[400]};
        background: ${baseTheme.colors.red[100]}40;
        border-radius: 8px;
        box-shadow:
          0 2px 8px ${baseTheme.colors.red[200]}60,
          0 1px 3px ${baseTheme.colors.red[300]}40;
        overflow: hidden;
        backdrop-filter: blur(4px);
      `}
    >
      <div
        className={css`
          padding: 16px 20px;
          background: ${baseTheme.colors.red[100]}20;
          color: ${baseTheme.colors.red[700]};
          font-weight: 500;
          font-size: 0.9rem;
          line-height: 1.4;
        `}
      >
        <span
          className={css`
            font-weight: bold;
          `}
        >
          {formattedError.boldPart}
        </span>
        <span
          className={css`
            font-weight: normal;
          `}
        >
          {formattedError.normalPart}
        </span>
      </div>

      {hasDetails && (
        <div
          className={css`
            padding: 12px 20px;
            background-color: ${baseTheme.colors.red[100]}25;
            border-top: 1px solid ${baseTheme.colors.red[200]}50;
          `}
        >
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={css`
              display: flex;
              align-items: center;
              gap: 6px;
              background: none;
              border: none;
              color: ${baseTheme.colors.red[600]};
              font-size: 0.85rem;
              font-weight: 500;
              cursor: pointer;
              padding: 0;
              transition: all 0.2s ease;

              &:hover {
                color: ${baseTheme.colors.red[700]};
                transform: translateX(2px);
              }

              svg {
                width: 12px;
                height: 12px;
                transition: transform 0.2s ease;
                transform: ${showDetails ? "rotate(90deg)" : "rotate(0deg)"};
              }
            `}
          >
            <ArrowRight />
            {showDetails ? t("error-hide-details") : t("error-show-details")}
          </button>

          {showDetails && (
            <div
              className={css`
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid ${baseTheme.colors.red[200]}33;
                animation: slideDown 0.2s ease-out;

                @keyframes slideDown {
                  from {
                    opacity: 0;
                    transform: translateY(-8px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}
            >
              {formattedError.details.map((detail, index) => (
                <div
                  key={index}
                  className={css`
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    background-color: ${baseTheme.colors.red[100]}20;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    color: ${baseTheme.colors.red[600]};
                    font-family: ${monospaceFont};
                  `}
                >
                  {detail}
                </div>
              ))}

              <details
                className={css`
                  margin-top: 12px;
                  border: 1px solid ${baseTheme.colors.red[200]}50;
                  border-radius: 4px;
                  overflow: hidden;

                  summary {
                    cursor: pointer;
                    font-size: 0.8rem;
                    color: ${baseTheme.colors.red[500]};
                    font-weight: 500;
                    padding: 8px 12px;
                    list-style: none;
                    background-color: ${baseTheme.colors.red[100]}30;
                    transition: all 0.2s ease;

                    &::-webkit-details-marker {
                      display: none;
                    }

                    &::before {
                      content: "▶";
                      margin-right: 8px;
                      transition: transform 0.2s ease;
                      font-size: 0.7rem;
                      display: inline-block;
                    }

                    &:hover {
                      color: ${baseTheme.colors.red[600]};
                      background-color: ${baseTheme.colors.red[100]}40;
                    }
                  }

                  &[open] summary::before {
                    transform: rotate(90deg);
                  }

                  pre {
                    margin: 0;
                    font-size: 0.75rem;
                    background-color: ${baseTheme.colors.red[100]}15;
                    padding: 16px;
                    border: none;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    overflow-wrap: break-word;
                    font-family: ${monospaceFont};
                    color: ${baseTheme.colors.red[600]};
                    line-height: 1.5;
                    max-height: 400px;
                    overflow-y: auto;
                  }
                `}
              >
                <summary>{t("error-original-message")}</summary>
                <pre>{formatOriginalErrorMessage(formattedError.originalMessage)}</pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ErrorDisplay
