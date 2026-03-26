"use client"

import { css, cx } from "@emotion/css"
import React, { useId, useImperativeHandle, useMemo, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"
import { summarizeFiles } from "../lib/utils/files"

import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"
import { fileButtonCss, fileTriggerRowCss } from "./primitives/selectStyles"

const fileSummaryCss = css`
  color: var(--field-description);
  font-size: 0.9375rem;
  line-height: 1.45;
`

export type FileFieldProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  buttonLabel?: React.ReactNode
  isDisabled?: boolean
  isRequired?: boolean
  isInvalid?: boolean
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
      className,
      disabled,
      required,
      onChange,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const { t } = useTranslation()
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
    const descriptionId = useId()
    const errorMessageId = useId()
    const state = resolveFieldState({
      disabled,
      required,
      isDisabled,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    })
    const describedBy = resolveFieldDescribedBy({
      ariaDescribedBy,
      descriptionId,
      errorMessageId,
      hasDescription: Boolean(description),
      hasErrorMessage: Boolean(errorMessage),
    })

    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

    const [fileSummary, setFileSummary] = useState(() => fileSummaryLabels.empty)

    return (
      <FieldShell
        className={className}
        label={label}
        inputId={inputId}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        errorMessage={errorMessage}
        errorMessageId={errorMessage ? errorMessageId : undefined}
        isDisabled={state.isDisabled}
        isRequired={state.isRequired}
        layout={stackedLayout}
      >
        <div className={fileTriggerRowCss}>
          <VisuallyHidden>
            <input
              {...rest}
              id={inputId}
              ref={inputRef}
              type="file"
              disabled={state.isDisabled}
              required={state.isRequired}
              aria-describedby={describedBy}
              aria-invalid={state.isInvalid ? "true" : undefined}
              onChange={(event) => {
                setFileSummary(summarizeFiles(event.currentTarget.files, fileSummaryLabels))
                onChange?.(event)
              }}
            />
          </VisuallyHidden>
          <button
            className={cx(fileButtonCss, resolveFileButtonSizeCss(fieldSize))}
            type="button"
            disabled={state.isDisabled}
            onClick={() => {
              inputRef.current?.click()
            }}
          >
            {buttonLabel}
          </button>
          <div className={fileSummaryCss}>{fileSummary}</div>
        </div>
      </FieldShell>
    )
  },
)
