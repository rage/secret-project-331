"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { CompletionsTabContent } from "../tabs/CompletionsTab"

export default withErrorBoundary(withSignedIn(CompletionsTabContent))
