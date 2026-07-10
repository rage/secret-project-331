import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Example exercise" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <RootDocument>
      <ClientLayoutWrapper>
        <Outlet />
      </ClientLayoutWrapper>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      {/* oxlint-disable-next-line @next/next/no-head-element -- TanStack Start renders a real <head>, not the Next Head component */}
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  const { t } = useTranslation()
  return (
    <div>
      <h2>{t("not-found")}</h2>
      <p>{t("could-not-find-requested-resource")}</p>
    </div>
  )
}
