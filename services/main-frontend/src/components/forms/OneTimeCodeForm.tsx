"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, OtpField } from "@/shared-module/components"

interface ResendProps {
  helperText: string
  label: string
  onResend: () => void
  cooldownSeconds?: number
  /** When the pending code went out, so reopening the form does not offer a resend the server refuses. */
  lastSentAt?: string | null
  /** The outcome of the last resend, shown in place of the resend line's helper text. */
  statusMessage?: React.ReactNode
}

interface OneTimeCodeFormProps {
  title?: string
  message: React.ReactNode
  onSubmit: (code: string) => void | Promise<void>
  submitLabel: string
  error?: string | null
  isSubmitting?: boolean
  resend?: ResendProps
  /** Submits as soon as the last digit is in. Leave off where submitting is destructive. */
  submitOnComplete?: boolean
  containerClassName?: string
}

const CODE_LENGTH = 6
const DEFAULT_COOLDOWN_SECONDS = 60

const containerCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 3rem 0rem;

  p {
    margin: 0;
  }
`

/** Grey rather than the primary's faded teal, which reads as broken instead of not-yet. */
const submitButtonCss = css`
  width: 100%;

  &&:disabled {
    opacity: 1;
    background: var(--color-gray-100);
    border-color: var(--color-gray-100);
    color: var(--color-gray-500);
  }
`

const resendLineCss = css`
  text-align: center;
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const resendButtonCss = css`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--color-green-700);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: 2px;
    border-radius: 2px;
  }

  &:disabled {
    font-weight: 500;
    color: var(--color-gray-600);
    cursor: default;
    text-decoration: none;
  }
`

const OneTimeCodeForm: React.FC<OneTimeCodeFormProps> = ({
  title,
  message,
  onSubmit,
  submitLabel,
  error,
  isSubmitting = false,
  resend,
  submitOnComplete = false,
  containerClassName,
}) => {
  const { t } = useTranslation()
  const { control, handleSubmit, watch, reset, setFocus } = useForm<{ code: string }>({
    defaultValues: { code: "" },
  })
  const code = watch("code")
  const cooldownSeconds = resend?.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS
  const [secondsUntilResend, startCooldown] = useCooldown(
    resend?.lastSentAt ? Date.parse(resend.lastSentAt) + cooldownSeconds * 1000 : 0,
  )

  const submit = handleSubmit(async (values) => {
    await onSubmit(values.code)
    // A refused code is cleared for the next try; an accepted one unmounts the form anyway.
    reset({ code: "" })
    // oxlint-disable-next-line i18next/no-literal-string
    setFocus("code")
  })

  return (
    <form onSubmit={submit} aria-describedby={error ? "code-error" : undefined}>
      <div className={cx(containerCss, containerClassName)}>
        {title && <h1>{title}</h1>}
        <p>{message}</p>

        {/* Wrapper carries the test id: OtpField renders one input per character and exposes no
            handle of its own. */}
        <div data-testid="one-time-code-field">
          <OtpField
            name="code"
            control={control}
            label={t("verification-code-label")}
            length={CODE_LENGTH}
            // oxlint-disable-next-line i18next/no-literal-string
            fieldSize="lg"
            isFullWidth
            groupSize={3}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the form exists only to take the code just sent
            autoFocus
            autoComplete="one-time-code"
            errorMessage={error ?? undefined}
            onComplete={() => {
              if (submitOnComplete && !isSubmitting) {
                void submit()
              }
            }}
          />
        </div>

        {/* Live region stays in the DOM so assistive tech registers it before the error text is
            inserted; otherwise the announcement can be missed. */}
        <VisuallyHidden>
          <div id="code-error" aria-live="assertive">
            {error ?? null}
          </div>
        </VisuallyHidden>

        <Button
          type="submit"
          variant="primary"
          size="medium"
          isLoading={isSubmitting}
          disabled={(code?.length ?? 0) !== CODE_LENGTH}
          className={submitButtonCss}
        >
          {submitLabel}
        </Button>

        {resend && (
          <p className={resendLineCss}>
            {resend.statusMessage ? (
              <span role="status">{resend.statusMessage}</span>
            ) : (
              resend.helperText
            )}{" "}
            <button
              type="button"
              className={resendButtonCss}
              disabled={secondsUntilResend > 0}
              onClick={() => {
                resend.onResend()
                startCooldown(Date.now() + cooldownSeconds * 1000)
              }}
            >
              {secondsUntilResend > 0
                ? t("resend-code-in", { time: formatMinutesSeconds(secondsUntilResend) })
                : resend.label}
            </button>
          </p>
        )}
      </div>
    </form>
  )
}

export default OneTimeCodeForm

const formatMinutesSeconds = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`

/** Seconds left until `until` (epoch ms), ticking; `start` only ever pushes the end later. */
function useCooldown(initialUntil: number) {
  const [until, setUntil] = React.useState(initialUntil)
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    setUntil((current) => Math.max(current, initialUntil))
  }, [initialUntil])

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000))

  React.useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }
    const timeout = setTimeout(() => setNow(Date.now()), 1000)
    return () => clearTimeout(timeout)
  }, [secondsLeft, now])

  const start = (nextUntil: number) => {
    setNow(Date.now())
    setUntil((current) => Math.max(current, nextUntil))
  }

  return [secondsLeft, start] as const
}
