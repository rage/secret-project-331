"use client"

import { act, renderHook } from "@testing-library/react"

import useScrollToUrlHash from "../useScrollToUrlHash"

const FIRST_ATTEMPT_MS = 100

const renderWithHash = (hash: string, options?: { matchHeadingIdPrefix?: boolean }) => {
  window.history.replaceState(null, "", `/${hash}`)
  renderHook(() => useScrollToUrlHash("/page", options))
  act(() => {
    jest.advanceTimersByTime(FIRST_ATTEMPT_MS)
  })
}

const addElement = (id: string) => {
  const element = document.createElement("div")
  element.id = id
  document.body.append(element)
  return element
}

describe("useScrollToUrlHash", () => {
  const scrolledTo: Element[] = []

  beforeAll(() => {
    jest.useFakeTimers()
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this)
    }
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    scrolledTo.length = 0
    document.body.innerHTML = ""
  })

  it("scrolls to an element whose id matches the hash as written", () => {
    const literal = addElement("a%20b")
    addElement("a b")
    renderWithHash("#a%20b")

    expect(scrolledTo).toEqual([literal])
  })

  it("scrolls to the decoded id when nothing matches the hash as written", () => {
    const heading = addElement("3f2b8c1a-розділ-1")
    renderWithHash(`#${encodeURIComponent("3f2b8c1a-розділ-1")}`)

    expect(scrolledTo).toEqual([heading])
  })

  it("leaves the page in place when a hash that is not valid percent-encoding matches nothing", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    addElement("100-done")

    expect(() => renderWithHash("#100%-done")).not.toThrow()
    expect(scrolledTo).toEqual([])
  })

  it("scrolls to a plain id", () => {
    const heading = addElement("heading-2")
    renderWithHash("#heading-2")

    expect(scrolledTo).toEqual([heading])
  })

  it("scrolls to the heading with the same id part when the prefix match is enabled", () => {
    const heading = addElement("3f2b8c1a-new-title")
    renderWithHash("#3f2b8c1a-old-title", { matchHeadingIdPrefix: true })

    expect(scrolledTo).toEqual([heading])
  })

  it("does not fall back to the id part when the prefix match is disabled", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {})
    addElement("3f2b8c1a-new-title")
    renderWithHash("#3f2b8c1a-old-title")

    expect(scrolledTo).toEqual([])
  })
})
