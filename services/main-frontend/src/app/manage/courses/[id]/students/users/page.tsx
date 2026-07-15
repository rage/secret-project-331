"use client"

import { UserTabContent } from "../tabs/UserTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(UserTabContent))
