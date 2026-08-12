"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import References from "./References"

function OtherReferencesPage() {
  const params = useParams<{ id: string }>()
  return <References courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherReferencesPage))
