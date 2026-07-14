"use client"

import { css, cx } from "@emotion/css"
import React, { useId, useMemo, useRef, useState } from "react"
import { useField, VisuallyHidden } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { composeRefs } from "../lib/utils/compositeField"
import { joinAriaDescribedBy } from "../lib/utils/field"
import { summarizeFiles } from "../lib/utils/files"
import { fileListToArray } from "../lib/utils/rhfAdapters"

import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"
import { fileButtonCss, fileTriggerRowCss } from "./primitives/selectStyles"

const fileSummaryCss = css`
  color: var(--field-description);
  font-size: 0.9375rem;
  line-height: 1.45;
`

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

// oxlint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

function resolveFileButtonSizeCss(fieldSize: FieldSize) {
  switch (fieldSize) {
    case "sm":
      return fileButtonSmCss
    case "lg":
      return fileButtonLgCss
    default:
      return fileButtonMdCss
  }
}

/**
 * File picker with summary text; form value is `File[]`.
 * Uses react-hook-form; pass `name` and `control`. The hidden `<input type="file">` is the native picker only;
 * RHF state is updated from its change event, not as a separate submission primitive.
 *
 * @example
 * <FileField name="attachment" control={control} label="Attachment" />
 */
export type FileFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  buttonLabel?: React.ReactNode
  isDisabled?: boolean
  isRequired?: boolean
  summaryFormatter?: (files: File[] | null) => React.ReactNode
  id?: string
  className?: string
  multiple?: boolean
}

export function FileField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: FileFieldProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    id,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    buttonLabel: buttonLabelProp,
    isDisabled = false,
    isRequired = false,
    summaryFormatter,
    className,
    multiple,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })

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

  const { labelProps, fieldProps, descriptionProps, errorMessageProps } = useField({
    label,
    description,
    errorMessage: resolvedError,
    id: inputId,
    isInvalid,
  })
  const buttonDescribedBy = joinAriaDescribedBy(
    typeof fieldProps["aria-describedby"] === "string" ? fieldProps["aria-describedby"] : undefined,
    isRequired ? requiredStateId : undefined,
    isInvalid && !resolvedError ? invalidStateId : undefined,
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileSummary, setFileSummary] = useState<React.ReactNode>(fileSummaryLabels.empty)

  return (
    <FieldShell
      className={className}
      label={label}
      labelProps={labelProps as React.HTMLAttributes<HTMLElement>}
      description={description}
      descriptionProps={descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={resolvedError}
      errorMessageProps={errorMessageProps as React.HTMLAttributes<HTMLElement>}
      isDisabled={isDisabled}
      isRequired={isRequired}
      layout={stackedLayout}
    >
      <div className={fileTriggerRowCss}>
        <VisuallyHidden>
          <input
            ref={composeRefs(inputRef, field.ref)}
            type="file"
            name={field.name}
            multiple={multiple}
            disabled={isDisabled}
            required={isRequired}
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const next = fileListToArray(event.currentTarget.files)
              setFileSummary(summaryFormatter?.(next) ?? summarizeFiles(next, fileSummaryLabels))
              field.onChange(next)
            }}
          />
        </VisuallyHidden>
        <button
          {...fieldProps}
          className={cx(fileButtonCss, resolveFileButtonSizeCss(fieldSize))}
          type="button"
          disabled={isDisabled}
          data-invalid={isInvalid ? "true" : undefined}
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
        {isRequired || (isInvalid && !resolvedError) ? (
          <VisuallyHidden>
            <>
              {isRequired ? <span id={requiredStateId}>{t("required")}</span> : null}
              {isInvalid && !resolvedError ? (
                <span id={invalidStateId}>{t("error-title")}</span>
              ) : null}
            </>
          </VisuallyHidden>
        ) : null}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- styled div role=status; <output> is inline, changes styling */}
        <div aria-live="polite" className={fileSummaryCss} role="status">
          {fileSummary}
        </div>
      </div>
    </FieldShell>
  )
}
