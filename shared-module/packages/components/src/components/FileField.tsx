"use client"

import { css, cx } from "@emotion/css"
import React, { useId, useMemo, useRef, useState } from "react"
import { useField, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { ButtonDomProps, InputDomProps } from "../lib/types/domProps"
import { composeRefs } from "../lib/utils/compositeField"
import { joinAriaDescribedBy, resolveFieldState } from "../lib/utils/field"
import { summarizeFiles } from "../lib/utils/files"

import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"
import { fileButtonCss, fileTriggerRowCss } from "./primitives/selectStyles"

const fileSummaryCss = css`
  color: var(--field-description);
  font-size: 0.9375rem;
  line-height: 1.45;
`

export type FileFieldProps = {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  buttonLabel?: React.ReactNode
  isDisabled?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  summaryFormatter?: (files: FileList | null) => React.ReactNode
  id?: string
  name?: string
  disabled?: boolean
  required?: boolean
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  className?: string
  inputDomProps?: InputDomProps
  domProps?: ButtonDomProps
}

const fileButtonSmCss = css`
  min-height: var(--control-height-sm);
  padding: 0 var(--control-padding-x-sm);
  font-size: var(--font-size-sm);
`

const fileButtonMdCss = css`
  min-height: var(--control-height-md);
  padding: 0 var(--control-padding-x-md);
  font-size: var(--font-size-md);
`

const fileButtonLgCss = css`
  min-height: var(--control-height-lg);
  padding: 0 var(--control-padding-x-lg);
  font-size: var(--font-size-lg);
`

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

function resolveFileButtonSizeCss(fieldSize: FieldSize) {
  switch (fieldSize) {
    case "sm":
      return fileButtonSmCss
    case "lg":
      return fileButtonLgCss
    case "md":
    default:
      return fileButtonMdCss
  }
}

export const FileField = React.forwardRef<HTMLInputElement, FileFieldProps>(
  function FileField(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      buttonLabel: buttonLabelProp,
      isDisabled,
      isRequired,
      isInvalid,
      summaryFormatter,
      className,
      disabled,
      required,
      onChange,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      domProps,
      inputDomProps,
    } = props

    const { t } = useTranslation("shared-module")
    const fileSummaryLabels = useMemo(
      () => ({
        empty: t("fileField.empty"),
        unnamedFile: t("fileField.unnamed"),
        formatMoreFiles: (additionalCount: number) =>
          t("fileField.moreFiles", { count: additionalCount }),
      }),
      [t],
    )
    const buttonLabel = buttonLabelProp ?? t("fileField.chooseFile")

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const buttonLabelId = useId()
    const requiredStateId = useId()
    const invalidStateId = useId()
    const state = resolveFieldState({
      disabled,
      required,
      isDisabled,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    })
    const { labelProps, fieldProps, descriptionProps, errorMessageProps } = useField({
      label,
      description,
      errorMessage,
      id: inputId,
      isInvalid: state.isInvalid,
      "aria-describedby": ariaDescribedBy,
    })
    const buttonDescribedBy = joinAriaDescribedBy(
      typeof fieldProps["aria-describedby"] === "string"
        ? fieldProps["aria-describedby"]
        : undefined,
      state.isRequired ? requiredStateId : undefined,
      state.isInvalid && !errorMessage ? invalidStateId : undefined,
    )

    const inputRef = useRef<HTMLInputElement>(null)
    const mergedInputRef = composeRefs(inputRef, forwardedRef)
    const [fileSummary, setFileSummary] = useState<React.ReactNode>(fileSummaryLabels.empty)

    return (
      <FieldShell
        className={className}
        label={label}
        labelProps={labelProps as React.HTMLAttributes<HTMLElement>}
        description={description}
        descriptionProps={descriptionProps as React.HTMLAttributes<HTMLElement>}
        errorMessage={errorMessage}
        errorMessageProps={errorMessageProps as React.HTMLAttributes<HTMLElement>}
        isDisabled={state.isDisabled}
        isRequired={state.isRequired}
        layout={stackedLayout}
      >
        <div className={fileTriggerRowCss}>
          <VisuallyHidden>
            <input
              {...(inputDomProps ?? {})}
              ref={mergedInputRef}
              type="file"
              disabled={state.isDisabled}
              required={state.isRequired}
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                setFileSummary(
                  summaryFormatter?.(event.currentTarget.files) ??
                    summarizeFiles(event.currentTarget.files, fileSummaryLabels),
                )
                onChange?.(event)
              }}
            />
          </VisuallyHidden>
          <button
            {...fieldProps}
            {...(domProps ?? {})}
            className={cx(fileButtonCss, resolveFileButtonSizeCss(fieldSize))}
            type="button"
            disabled={state.isDisabled}
            data-invalid={state.isInvalid ? "true" : undefined}
            aria-describedby={buttonDescribedBy}
            aria-labelledby={
              typeof fieldProps["aria-labelledby"] === "string"
                ? `${fieldProps["aria-labelledby"]} ${buttonLabelId}`
                : buttonLabelId
            }
            onClick={() => {
              inputRef.current?.click()
            }}
          >
            <span id={buttonLabelId}>{buttonLabel}</span>
          </button>
          {state.isRequired || (state.isInvalid && !errorMessage) ? (
            <VisuallyHidden>
              <>
                {state.isRequired ? <span id={requiredStateId}>{t("required")}</span> : null}
                {state.isInvalid && !errorMessage ? (
                  <span id={invalidStateId}>{t("error-title")}</span>
                ) : null}
              </>
            </VisuallyHidden>
          ) : null}
          <div aria-live="polite" className={fileSummaryCss} role="status">
            {fileSummary}
          </div>
        </div>
      </FieldShell>
    )
  },
)

FileField.displayName = "FileField"
