"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { ProgressTabContent } from "../tabs/ProgressTab"

export default withErrorBoundary(withSignedIn(ProgressTabContent))
