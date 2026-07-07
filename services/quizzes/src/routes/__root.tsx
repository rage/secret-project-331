import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { type ReactNode, Suspense, useEffect } from "react"
import { useTranslation } from "react-i18next"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"
import Spinner from "@/shared-module/common/components/Spinner"
import { installGlobalErrorReporting } from "@/shared-module/common/errors/installGlobalErrorReporting"

const SERVICE_NAME = "quizzes"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quizzes" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  useEffect(() => {
    installGlobalErrorReporting({ service: SERVICE_NAME })
  }, [])

  return (
    <RootDocument>
      <Suspense fallback={<Spinner />}>
        <ClientLayoutWrapper>
          <Outlet />
        </ClientLayoutWrapper>
      </Suspense>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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
