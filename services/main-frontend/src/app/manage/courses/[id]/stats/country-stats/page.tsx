"use client"

import { useParams } from "next/navigation"
import React from "react"

import CountryStatsTab from "../tabs/CountryStatsTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function StatsCountryStatsPage() {
  const params = useParams<{ id: string }>()
  return <CountryStatsTab courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(StatsCountryStatsPage))
