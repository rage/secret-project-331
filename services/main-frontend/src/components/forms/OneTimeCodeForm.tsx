"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"

import Button from "@/shared-module/common/components/Button"
import OneTimePassCodeField from "@/shared-module/common/components/InputFields/OneTimePasscodeField"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

interface ResendProps {
  helperText: string
  label: string
  onResend: () => void
  cooldownSeconds?: number
}

interface OneTimeCodeFormProps {
  title?: string
  message: React.ReactNode
  onSubmit: (code: string) => void | Promise<void>
  submitLabel: string
  error?: string | null
  isSubmitting?: boolean
  resend?: ResendProps
  containerClassName?: string
}

const OneTimeCodeForm: React.FC<OneTimeCodeFormProps> = ({
  title,
  message,
  onSubmit,
  submitLabel,
  error,
  isSubmitting = false,
  resend,
  containerClassName,
}) => {
  const codeLength = 6
  const { handleSubmit, setValue, watch } = useForm<{ code: string }>({
    defaultValues: { code: "" },
  })
  const code = watch("code")
  const [resendCooldown, startCooldown] = useCooldown()
  const hasError = Boolean(error)

  return (
    <form
      onSubmit={handleSubmit(({ code }) => onSubmit(code))}
      aria-describedby={hasError ? "code-error" : undefined}
    >
      <div
        className={cx(
          css`
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 3rem 0rem;
          `,
          containerClassName,
        )}
      >
        {title && <h1>{title}</h1>}
        <p>{message}</p>

        <OneTimePassCodeField onChange={(val) => setValue("code", val, { shouldValidate: true })} />

        {hasError && (
          <div
            id="code-error"
            aria-live="assertive"
            className={css`
              padding: 10px;
              border: 2px solid ${baseTheme.colors.red[500]};
              font-weight: bold;
              color: ${baseTheme.colors.red[500]};
            `}
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={(code?.length ?? 0) !== codeLength || isSubmitting}
          className={css`
            padding-top: 10px;
          `}
        >
          {isSubmitting ? <Spinner variant="small" /> : submitLabel}
        </Button>

        {resend && (
          <div
            className={css`
              display: flex;
              flex-direction: row;
              align-items: baseline;
            `}
          >
            <p>{resend.helperText}</p>
            <Button
              variant="icon"
              size="small"
              transform="none"
              disabled={resendCooldown > 0}
              onClick={() => {
                resend.onResend()
                startCooldown(resend.cooldownSeconds ?? 60)
              }}
              className={css`
                padding-left: 4px !important;
                color: ${baseTheme.colors.green[600]}!important;
              `}
            >
              {resendCooldown > 0 ? `${resend.label} (${resendCooldown})` : resend.label}
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}

export default OneTimeCodeForm

function useCooldown(initial = 0) {
  const [timeLeft, setTimeLeft] = React.useState(initial)

  const start = (seconds: number) => {
    if (timeLeft > 0) {
      return
    }
    setTimeLeft(seconds)
  }

  React.useEffect(() => {
    if (timeLeft <= 0) {
      return
    }
    const timeout = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    return () => clearTimeout(timeout)
  }, [timeLeft])

  return [timeLeft, start] as const
}
