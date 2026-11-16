"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"

import type { Page } from "@/generated/api/types.generated"

import PageRowActions from "../PageRowActions"

jest.mock("@/generated/api/sdk.generated", () => ({}))

const page = { id: "page-1", title: "Foo", course_id: "course-1", chapter_id: null } as Page

describe("PageRowActions", () => {
  it("exposes Edit page as a single link named with the page title", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PageRowActions
          page={page}
          pageOrderDispatch={jest.fn()}
          onDeletePage={null}
          moving="allowed"
          chapter={undefined}
          reload={jest.fn()}
        />
      </QueryClientProvider>,
    )

    const link = screen.getByRole("link", { name: "edit-page-named" })
    expect(link).toHaveAttribute("href", "/cms/pages/page-1")
    expect(link.querySelector("button")).toBeNull()
    expect(link.closest("button")).toBeNull()
    expect(screen.getByRole("button", { name: "page-actions-for" })).toBeInTheDocument()
  })
})
