"use client"

import { css } from "@emotion/css"
import "altcha/types/react"
import type { AltchaWidgetElement } from "altcha/types/generic"
import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

import type { ChallengePurpose } from "@/shared-module/common/generated/auth-api/types.generated"

const CHALLENGE_URL = "/api/v0/auth/altcha-challenge"
const WIDGET_TAG = "altcha-widget"

/** Under the server's 10-minute challenge lifetime, so a kept solution is never sent expired. */
const SOLUTION_MAX_AGE_MS = 8 * 60 * 1000

/** Most solves finish sooner; only a longer wait shows the message. */
const WAITING_MESSAGE_DELAY_MS = 1000

export interface AltchaWidgetHandle {
  /**
   * Takes the solution to send as `altcha`, waiting for the solve if needed, and starts the next
   * one: the server accepts a solution only once. Rejects when solving fails. Resolves to "" on a
   * plain-HTTP development host, where browsers refuse to solve.
   */
  solve: () => Promise<string>
}

interface AltchaWidgetProps {
  ref?: React.Ref<AltchaWidgetHandle>
  /** The form the challenge is for; the server accepts the solution only there. */
  purpose: ChallengePurpose
}

interface StateChangeDetail {
  state: string
  payload?: string
}

interface Solution {
  payload: string
  solvedAt: number
}

/**
 * The proof-of-work check the signup and password reset forms require. Invisible: it solves in the
 * background from page load, and the form awaits [AltchaWidgetHandle.solve] on submit. A message
 * shows only when that wait is long. The form needs `noValidate`: the widget keeps a hidden required
 * checkbox that would otherwise block the submit.
 */
const AltchaWidget: React.FC<AltchaWidgetProps> = ({ ref, purpose }) => {
  const { t } = useTranslation()
  const { t: tErrors } = useTranslation("errors")
  const widgetRef = useRef<AltchaWidgetElement>(null)
  const solutionRef = useRef<Solution | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)

  useImperativeHandle(ref, () => ({
    solve: async () => {
      if (!window.isSecureContext) {
        return ""
      }
      const widget = widgetRef.current
      const kept = solutionRef.current
      let payload = kept && Date.now() - kept.solvedAt < SOLUTION_MAX_AGE_MS ? kept.payload : null
      solutionRef.current = null
      if (!payload && widget) {
        const timer = setTimeout(() => setIsWaiting(true), WAITING_MESSAGE_DELAY_MS)
        try {
          payload = await solveNow(widget)
        } finally {
          clearTimeout(timer)
          setIsWaiting(false)
        }
        solutionRef.current = null
      }
      if (!payload) {
        throw new Error(tErrors("error-message-key.form_verification_failed.message"))
      }
      if (widget) {
        void solveNow(widget)
      }
      return payload
    },
  }))

  const isSecureContext = useSyncExternalStore(
    subscribeToNothing,
    () => window.isSecureContext,
    () => true,
  )

  useEffect(() => {
    const widget = widgetRef.current
    if (!widget) {
      return
    }
    const handleStateChange = (event: Event) => {
      const { state, payload } = (event as CustomEvent<StateChangeDetail>).detail
      solutionRef.current =
        state === "verified" && payload ? { payload, solvedAt: Date.now() } : null
    }
    widget.addEventListener("statechange", handleStateChange)
    let isMounted = true
    loadWidget()
      .then(() => {
        if (isMounted && widget.getState() === "unverified") {
          void widget.verify()
        }
      })
      .catch(() => {
        // solve() loads it again on submit.
      })
    return () => {
      isMounted = false
      widget.removeEventListener("statechange", handleStateChange)
    }
  }, [isSecureContext])

  // On the plain-HTTP development host the widget could only fail; solve() sends "" there.
  if (!isSecureContext) {
    return null
  }

  return (
    <>
      <altcha-widget
        ref={widgetRef}
        challenge={`${CHALLENGE_URL}?purpose=${purpose}`}
        // oxlint-disable-next-line i18next/no-literal-string -- widget option value
        display="invisible"
        className={css`
          display: none;
        `}
      />
      {isWaiting && <p role="status">{t("checking-your-browser")}</p>}
    </>
  )
}

function subscribeToNothing() {
  return () => {}
}

let widgetLoad: Promise<unknown> | null = null

/** The widget touches `window` when imported, so it may only load in the browser. */
function loadWidget(): Promise<unknown> {
  widgetLoad ??= import("altcha")
    .then(() => customElements.whenDefined(WIDGET_TAG))
    .catch((error: unknown) => {
      widgetLoad = null
      throw error
    })
  return widgetLoad
}

/** Solves now, or waits for a solve already in progress. Resolves to null when solving fails. */
async function solveNow(widget: AltchaWidgetElement): Promise<string | null> {
  try {
    await loadWidget()
    if (widget.getState() !== "verifying") {
      widget.reset()
      return (await widget.verify())?.payload ?? null
    }
  } catch {
    return null
  }
  return new Promise((resolve) => {
    const handleStateChange = (event: Event) => {
      const { state, payload } = (event as CustomEvent<StateChangeDetail>).detail
      if (state === "verifying") {
        return
      }
      widget.removeEventListener("statechange", handleStateChange)
      resolve(state === "verified" ? (payload ?? null) : null)
    }
    widget.addEventListener("statechange", handleStateChange)
  })
}

export default AltchaWidget
