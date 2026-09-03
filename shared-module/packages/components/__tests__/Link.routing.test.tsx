"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import type { NextRouter } from "next/router"
import React from "react"

import { Link } from "../src/components/Link"
import "../tests/test-i18n"

// The manual mock in __mocks__/next/link.tsx applies without a jest.mock call, and it routes
// nothing. These tests are about what the real next/link does with the props we hand it.
jest.unmock("next/link")

const EXPORT_HREF = "/api/v0/main-frontend/courses/1/export-points"
const CMS_HREF = "/cms/courses/1/research-form-edit"

interface FakeRouter {
  push: jest.Mock
  replace: jest.Mock
  prefetch: jest.Mock
  beforePopState: jest.Mock
}

function createRouter(): FakeRouter {
  return {
    push: jest.fn(() => Promise.resolve(true)),
    replace: jest.fn(() => Promise.resolve(true)),
    prefetch: jest.fn(() => Promise.resolve()),
    beforePopState: jest.fn(),
  }
}

function renderRouted(ui: React.ReactElement, router: FakeRouter) {
  const value = { ...router, pathname: "/", asPath: "/", query: {}, route: "/" }
  return render(
    <RouterContext.Provider value={value as unknown as NextRouter}>{ui}</RouterContext.Provider>,
  )
}

describe("Link client-router destinations", () => {
  test("an ordinary internal link navigates through the router", () => {
    const router = createRouter()
    renderRouted(<Link href="/settings">Settings</Link>, router)

    const link = screen.getByRole("link", { name: "Settings" })
    const notCancelled = fireEvent.click(link)

    expect(notCancelled).toBe(false)
    expect(router.push).toHaveBeenCalledTimes(1)
  })

  test("an ordinary internal link is prefetched on hover", () => {
    const router = createRouter()
    renderRouted(<Link href="/settings">Settings</Link>, router)

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Settings" }))

    expect(router.prefetch).toHaveBeenCalledTimes(1)
  })

  test("target='_self' still routes", () => {
    const router = createRouter()
    renderRouted(
      <Link href="/settings" target="_self">
        Settings
      </Link>,
      router,
    )

    fireEvent.click(screen.getByRole("link", { name: "Settings" }))

    expect(router.push).toHaveBeenCalledTimes(1)
  })

  test("a download link is neither routed nor prefetched", () => {
    const router = createRouter()
    renderRouted(
      <Link href={EXPORT_HREF} download>
        Export points
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Export points" })

    expect(link).toHaveAttribute("href", EXPORT_HREF)
    expect(link).toHaveAttribute("download")

    expect(fireEvent.click(link)).toBe(true)
    fireEvent.mouseEnter(link)

    expect(router.push).not.toHaveBeenCalled()
    expect(router.prefetch).not.toHaveBeenCalled()
  })

  test("a link opening in another tab is neither routed nor prefetched", () => {
    const router = createRouter()
    renderRouted(
      <Link href="/manage/courses/1" target="_blank" rel="noopener noreferrer">
        Manage
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Manage" })

    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")

    fireEvent.click(link)
    fireEvent.mouseEnter(link)

    expect(router.push).not.toHaveBeenCalled()
    expect(router.prefetch).not.toHaveBeenCalled()
  })

  test("an absolute url is left to the browser", () => {
    const router = createRouter()
    renderRouted(<Link href="https://example.com/docs">Docs</Link>, router)

    const link = screen.getByRole("link", { name: "Docs" })

    expect(link).toHaveAttribute("href", "https://example.com/docs")
    expect(fireEvent.click(link)).toBe(true)
    fireEvent.mouseEnter(link)

    expect(router.push).not.toHaveBeenCalled()
    expect(router.prefetch).not.toHaveBeenCalled()
  })

  test("isCrossService keeps the router off a path another service serves", () => {
    const router = createRouter()
    renderRouted(
      <Link href={CMS_HREF} isCrossService>
        Research form
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Research form" })

    expect(link).toHaveAttribute("href", CMS_HREF)
    expect(fireEvent.click(link)).toBe(true)
    fireEvent.mouseEnter(link)

    expect(router.push).not.toHaveBeenCalled()
    expect(router.prefetch).not.toHaveBeenCalled()
  })

  test("the same path without isCrossService is claimed by the router", () => {
    const router = createRouter()
    renderRouted(<Link href={CMS_HREF}>Research form</Link>, router)

    fireEvent.click(screen.getByRole("link", { name: "Research form" }))

    expect(router.push).toHaveBeenCalledTimes(1)
  })

  test("router-only props stay off the plain anchor", () => {
    const router = createRouter()
    renderRouted(
      <Link href={EXPORT_HREF} download prefetch={false} replace scroll={false}>
        Export points
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Export points" })

    expect(link).not.toHaveAttribute("prefetch")
    expect(link).not.toHaveAttribute("replace")
    expect(link).not.toHaveAttribute("scroll")
  })

  test("hrefLang and title reach the plain anchor", () => {
    const router = createRouter()
    renderRouted(
      <Link href="https://example.com/docs" hrefLang="fi" title="Ohjeet">
        Docs
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Docs" })

    expect(link).toHaveAttribute("hreflang", "fi")
    expect(link).toHaveAttribute("title", "Ohjeet")
  })

  test("styledAsButton styling and icon survive the plain-anchor path", () => {
    const router = createRouter()
    renderRouted(
      <Link
        href={EXPORT_HREF}
        download
        styledAsButton
        variant="secondary"
        size="large"
        icon={<span data-testid="icon">*</span>}
      >
        Export points
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Export points" })

    expect(link.getAttribute("class")).toBeTruthy()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
    expect(link).toHaveAttribute("download")
  })

  test("react-aria press handling works on the plain-anchor path", () => {
    const router = createRouter()
    const onPress = jest.fn()
    renderRouted(
      <Link href={EXPORT_HREF} download onPress={onPress}>
        Export points
      </Link>,
      router,
    )

    const link = screen.getByRole("link", { name: "Export points" })
    fireEvent.keyDown(link, { key: "Enter" })
    fireEvent.keyUp(link, { key: "Enter" })

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
