"use client"

import { createFileRoute } from "@tanstack/react-router"

// The exercise UI lives at /iframe (the parent app embeds it there via the service-info endpoint).
// This index route exists so the app has a matchable root for the SPA shell prerender; it is not
// part of the plugin protocol and is not normally visited.
export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  return (
    <main>
      <p>This is an exercise service. Its user interface is served at /iframe.</p>
    </main>
  )
}
