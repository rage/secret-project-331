"use client"

import { useCallback, useRef } from "react"

type EventCallback = (...args: never[]) => unknown

/** Like useEventCallback from React, but for backwards compatibility for the cms service */
export default function useEventCallback<T extends EventCallback>(callback: T): T {
  const callbackRef = useRef<T>(callback)
  callbackRef.current = callback

  return useCallback(
    ((...args: Parameters<T>): ReturnType<T> => callbackRef.current(...args) as ReturnType<T>) as T,
    [],
  )
}
