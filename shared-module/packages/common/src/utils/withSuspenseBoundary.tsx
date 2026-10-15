"use client"

import type { ComponentType } from "react"
import { Suspense } from "react"

import Spinner from "../components/Spinner"

const FALLBACK = <Spinner />

export default function withSuspenseBoundary<T>(Component: ComponentType<T>): ComponentType<T> {
  const SuspenseBoundary: ComponentType<T> = (props) => {
    const { ...componentProps } = props

    return (
      <Suspense fallback={FALLBACK}>
        {/* oxlint-disable-next-line typescript/ban-ts-comment */}
        {/* @ts-ignore: Shared module might have a different react version */}
        <Component {...(componentProps as T)} />
      </Suspense>
    )
  }

  SuspenseBoundary.displayName = `withSuspenseBoundary(${Component.displayName ?? Component.name ?? "Component"})`

  return SuspenseBoundary
}
