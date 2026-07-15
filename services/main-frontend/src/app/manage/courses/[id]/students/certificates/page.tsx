"use client"

import { CertificatesTabContent } from "../tabs/CertificatesTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(CertificatesTabContent))
