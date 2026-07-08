import { createFileRoute } from "@tanstack/react-router"

import IframeView from "@/components/IframeView"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"

// The exercise UI, rendered client-side at /{base}/iframe. The error boundary is a class component,
// so wrap it in a function for the route's `component` slot.
const BoundedIframeView = withErrorBoundary(withSuspenseBoundary(IframeView))

export const Route = createFileRoute("/iframe")({
  // The parent can constrain the editor width with ?width=<px>.
  validateSearch: (search: Record<string, unknown>): { width?: number } => {
    const width = Number(search.width)
    return Number.isFinite(width) && width > 0 ? { width } : {}
  },
  component: IframeRoute,
})

function IframeRoute() {
  const { width } = Route.useSearch()
  return <BoundedIframeView maxWidth={width ?? 500} />
}
