"use client"

import { useParams } from "next/navigation"

import References from "./References"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OtherReferencesPage() {
  const params = useParams<{ id: string }>()
  return <References courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherReferencesPage))
