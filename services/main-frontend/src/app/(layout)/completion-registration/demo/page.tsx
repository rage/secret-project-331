"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CreditRegistrationDemo from "./CreditRegistrationDemo"

export default withErrorBoundary(withSignedIn(CreditRegistrationDemo))
