"use client"

import { CompletionsTabContent } from "../tabs/CompletionsTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(CompletionsTabContent))
