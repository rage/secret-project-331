import { createFileRoute } from "@tanstack/react-router"

// The exercise UI lives at /iframe (the parent embeds it via service-info). This index route just
// gives the SPA shell prerender a matchable root; it's not part of the plugin protocol.
export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  return (
    <main>
      {/* oxlint-disable-next-line i18next/no-literal-string -- dev-facing placeholder, route not normally visited */}
      <p>This is an exercise service. Its user interface is served at /iframe.</p>
    </main>
  )
}
