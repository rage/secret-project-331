import { createFileRoute } from "@tanstack/react-router"

import IframeView from "@/components/IframeView"
import withErrorBoundary from "@/lib/withErrorBoundary"

// The exercise UI, rendered client-side at /{base}/iframe. The error boundary is a class component,
// so wrap it in a function for the route's `component` slot.
const BoundedIframeView = withErrorBoundary(IframeView)

export const Route = createFileRoute("/iframe")({
  component: () => <BoundedIframeView />,
})
