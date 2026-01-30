"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getPlaceholderConfig,
  PLACEHOLDER_CODE,
  PLACEHOLDER_RESET_LINK,
  PlaceholderValidationResult,
} from "../../utils/emailPlaceholders"

interface PlaceholderInfoProps {
  templateType: unknown
  validation: PlaceholderValidationResult
}

const PlaceholderInfo: React.FC<React.PropsWithChildren<PlaceholderInfoProps>> = ({
  templateType,
  validation,
}) => {
  const { t } = useTranslation()
  const templateTypeString =
    typeof templateType === "string" ? templateType : (templateType as unknown as string)

  if (templateTypeString === "generic") {
    return null
  }

  const config = getPlaceholderConfig(templateTypeString)

  const getPlaceholderDescription = (placeholder: string): string => {
    switch (placeholder) {
      case PLACEHOLDER_RESET_LINK:
        return t("placeholder-reset-link-description")
      case PLACEHOLDER_CODE:
        return t("placeholder-code-description")
      default:
        return ""
    }
  }

  if (!config) {
    return null
  }

  return (
    <div
      className={css`
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f9f9f9;
        margin-bottom: 1rem;
      `}
    >
      <h3
        className={css`
          margin-top: 0;
          margin-bottom: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
        `}
      >
        {t("email-placeholders")}
      </h3>

      {validation.errors.length > 0 && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {validation.errors.map((error, index) => (
            <div
              key={index}
              className={css`
                padding: 0.5rem;
                background-color: #f8d7da;
                border: 1px solid #dc3545;
                border-radius: 4px;
                color: #721c24;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
              `}
            >
              {error}
            </div>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {validation.warnings.map((warning, index) => (
            <div
              key={index}
              className={css`
                padding: 0.5rem;
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 4px;
                color: #856404;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
              `}
            >
              {warning}
            </div>
          ))}
        </div>
      )}

      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <div
          className={css`
            font-weight: 600;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
          `}
        >
          {t("available-placeholders")}:
        </div>
        {config.available.map((placeholder) => {
          const isDetected = validation.detectedPlaceholders.includes(placeholder)
          const isRequired = config.required.includes(placeholder)
          return (
            <div
              key={placeholder}
              className={css`
                padding: 0.5rem;
                margin-bottom: 0.5rem;
                border-radius: 4px;
                background-color: ${isDetected ? "#d4edda" : "#f8f9fa"};
                border: 1px solid ${isDetected ? "#c3e6cb" : "#dee2e6"};
                font-size: 0.875rem;
              `}
            >
              <code
                className={css`
                  font-weight: 600;
                  color: ${isDetected ? "#155724" : "#495057"};
                `}
              >
                {`{{${placeholder}}}`}
              </code>
              {isRequired && (
                <span
                  className={css`
                    margin-left: 0.5rem;
                    color: #dc3545;
                    font-size: 0.75rem;
                  `}
                >
                  ({t("required")})
                </span>
              )}
              {isDetected && (
                <span
                  className={css`
                    margin-left: 0.5rem;
                    color: #155724;
                    font-size: 0.75rem;
                  `}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {"✓ "}
                  {t("detected")}
                </span>
              )}
              {getPlaceholderDescription(placeholder) && (
                <div
                  className={css`
                    margin-top: 0.25rem;
                    color: #6c757d;
                    font-size: 0.75rem;
                  `}
                >
                  {getPlaceholderDescription(placeholder)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {validation.detectedPlaceholders.length === 0 && config.required.length > 0 && (
        <div
          className={css`
            padding: 0.5rem;
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            color: #856404;
            font-size: 0.875rem;
          `}
        >
          {t("no-placeholders-detected")}
        </div>
      )}
    </div>
  )
}

export default PlaceholderInfo
