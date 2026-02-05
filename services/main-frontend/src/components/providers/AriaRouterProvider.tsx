"use client"

import { useRouter } from "next/navigation"
import React from "react"
import { RouterProvider } from "react-aria"

interface AriaRouterProviderProps {
  children: React.ReactNode
}

export function AriaRouterProvider({ children }: AriaRouterProviderProps) {
  const router = useRouter()
  return <RouterProvider navigate={(href) => router.push(String(href))}>{children}</RouterProvider>
}
