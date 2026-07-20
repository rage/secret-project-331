"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { UserTabContent } from "../tabs/UserTab"

export default withErrorBoundary(withSignedIn(UserTabContent))
