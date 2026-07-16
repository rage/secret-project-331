"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { CertificatesTabContent } from "../tabs/CertificatesTab"

export default withErrorBoundary(withSignedIn(CertificatesTabContent))
