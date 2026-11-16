"use client"

import { addMilliseconds, differenceInMilliseconds, parseISO } from "date-fns"
import { useEffect, useState } from "react"

import { getCurrentTime } from "@/generated/api/sdk.generated"

const SAMPLE_COUNT = 7

export interface ClockSkewSample {
  offsetMs: number
  rttMs: number
}

export interface ClockSkewEstimate {
  finalOffsetMs: number
  sampleCount: number
  bestRttMs: number
}

const sampleClockOffset = async (): Promise<ClockSkewSample | null> => {
  const t0 = Date.now()
  const serverTime = await getCurrentTime({})
  const t1 = Date.now()
  if (typeof serverTime !== "string") {
    return null
  }
  const serverDate = parseISO(serverTime)
  const serverMs = serverDate.getTime()

  if (Number.isNaN(serverMs)) {
    return null
  }

  const rttMs = Math.max(0, differenceInMilliseconds(t1, t0))
  const estimatedServerAtReceiveMs = addMilliseconds(serverDate, rttMs / 2).getTime()
  const offsetMs = estimatedServerAtReceiveMs - t1

  return {
    offsetMs,
    rttMs,
  }
}

const chooseEstimateFromSamples = (samples: ClockSkewSample[]): ClockSkewEstimate | null => {
  if (samples.length === 0) {
    return null
  }

  const bestSample = samples.reduce((best, sample) => (sample.rttMs < best.rttMs ? sample : best))

  return {
    finalOffsetMs: bestSample.offsetMs,
    sampleCount: samples.length,
    bestRttMs: bestSample.rttMs,
  }
}

let cachedEstimate: Promise<ClockSkewEstimate | null> | null = null

const runSampling = async (): Promise<ClockSkewEstimate | null> => {
  const samples: ClockSkewSample[] = []
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    try {
      const sample = await sampleClockOffset()
      if (sample) {
        samples.push(sample)
      }
    } catch {
      // Ignore individual sample failures and use the rest.
    }
  }
  return chooseEstimateFromSamples(samples)
}

/** Test helper: forget the measured skew. */
export const resetClockSkewCache = () => {
  cachedEstimate = null
}

/** Measures the device clock against the server once per page load; null until known. */
export default function useClockSkew(): ClockSkewEstimate | null {
  const [estimate, setEstimate] = useState<ClockSkewEstimate | null>(null)

  useEffect(() => {
    let cancelled = false
    cachedEstimate ??= runSampling().then((result) => {
      if (!result) {
        cachedEstimate = null
      }
      return result
    })
    void cachedEstimate.then((result) => {
      if (!cancelled) {
        setEstimate(result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return estimate
}
