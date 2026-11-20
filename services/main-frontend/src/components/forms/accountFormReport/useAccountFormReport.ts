"use client"

import { useCallback, useEffect, useRef } from "react"

import { type FormInteractionTracker, trackFormInteraction } from "./trackFormInteraction"

export interface AccountFormReport {
  /** Attach to the `<form>`. */
  formRef: (form: HTMLFormElement | null) => void
  /** The value to send as `client_info`; "" when nothing could be collected. */
  report: () => string
}

/**
 * Collects the coarse browser report the account forms send as `client_info` for the server's
 * account form log.
 */
export function useAccountFormReport(): AccountFormReport {
  const trackerRef = useRef<FormInteractionTracker | null>(null)

  const formRef = useCallback((form: HTMLFormElement | null) => {
    trackerRef.current?.detach()
    trackerRef.current = form ? trackFormInteraction(form) : null
  }, [])

  useEffect(() => () => trackerRef.current?.detach(), [])

  const report = useCallback(() => {
    try {
      const body = { environment: environment(), input: trackerRef.current?.facts() ?? null }
      return btoa(unescape(encodeURIComponent(JSON.stringify(body))))
    } catch {
      return ""
    }
  }, [])

  return { formRef, report }
}

function environment() {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: { platform?: string }
  }
  let timezone: string | null = null
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    timezone = null
  }
  return {
    userAgent: nav.userAgent,
    languages: [...(nav.languages ?? [])].slice(0, 5),
    timezone,
    cores: nav.hardwareConcurrency ?? null,
    memory: nav.deviceMemory ?? null,
    touchPoints: nav.maxTouchPoints ?? 0,
    screen: [screen.width, screen.height],
    clientHintsPlatform: nav.userAgentData?.platform ?? null,
  }
}
