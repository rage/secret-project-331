/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { useController } from "react-hook-form"

import { useChartCaptionField } from "../../../src/blocks/Chart/useChartCaptionField"

const CAPTION_LABEL = "caption"

interface CaptionChange {
  caption: string
  spec?: string
}

const specWith = (description?: string): string =>
  JSON.stringify(description === undefined ? { mark: "bar" } : { mark: "bar", description })

interface FormProps {
  caption: string
  getCurrentSpec: () => string
  onCaptionChange: (change: CaptionChange) => void
}

/** The field bound to a real input, the way the shared TextField binds it. */
const CaptionForm: React.FC<FormProps> = ({ caption, getCurrentSpec, onCaptionChange }) => {
  const { control } = useChartCaptionField({ caption, getCurrentSpec, onCaptionChange })
  const { field } = useController({ name: "caption", control })
  return (
    <input
      aria-label={CAPTION_LABEL}
      value={field.value ?? ""}
      onChange={(event) => field.onChange(event.target.value)}
    />
  )
}

/**
 * Renders the field over a spec that the recorded changes are written back into, the way the modal
 * does, so each edit sees the spec the previous one produced.
 */
const renderCaptionField = (initialSpec: string, initialCaption = "") => {
  let currentSpec = initialSpec
  const onCaptionChange = jest.fn<(change: CaptionChange) => void>((change) => {
    if (change.spec !== undefined) {
      currentSpec = change.spec
    }
  })
  const view = render(
    <CaptionForm
      caption={initialCaption}
      getCurrentSpec={() => currentSpec}
      onCaptionChange={onCaptionChange}
    />,
  )
  const rerenderWithCaption = (caption: string) =>
    view.rerender(
      <CaptionForm
        caption={caption}
        getCurrentSpec={() => currentSpec}
        onCaptionChange={onCaptionChange}
      />,
    )
  return { onCaptionChange, rerenderWithCaption, getSpec: () => currentSpec }
}

const captionInput = () => screen.getByLabelText(CAPTION_LABEL) as HTMLInputElement

const captionValue = () => captionInput().value

const typeCaption = (value: string) => fireEvent.change(captionInput(), { target: { value } })

describe("useChartCaptionField", () => {
  it("starts the field at the stored caption", () => {
    renderCaptionField(specWith("Sales by month"), "Sales by month")

    expect(captionValue()).toBe("Sales by month")
  })

  it("follows the attribute when a spec edit syncs its description into the caption", async () => {
    const { rerenderWithCaption } = renderCaptionField(specWith("From the spec"), "")

    rerenderWithCaption("From the spec")

    await waitFor(() => expect(captionValue()).toBe("From the spec"))
  })

  it("writes an edited caption into the spec's description", () => {
    const { onCaptionChange, getSpec } = renderCaptionField(specWith(), "")

    typeCaption("A bar chart")

    expect(onCaptionChange).toHaveBeenCalledWith({
      caption: "A bar chart",
      spec: expect.any(String),
    })
    expect(JSON.parse(getSpec()).description).toBe("A bar chart")
  })

  it("removes the description when the caption is emptied", () => {
    const { onCaptionChange, getSpec } = renderCaptionField(specWith("Gone soon"), "Gone soon")

    typeCaption("   ")

    expect(onCaptionChange).toHaveBeenCalledWith({ caption: "   ", spec: expect.any(String) })
    expect("description" in JSON.parse(getSpec())).toBe(false)
  })

  it("does not rewrite the spec when it already says this, leaving the editor's caret alone", () => {
    // The state a spec edit leaves behind: the description is already what the caption becomes.
    const { onCaptionChange } = renderCaptionField(specWith("Already there"), "")

    typeCaption("Already there")

    expect(onCaptionChange).toHaveBeenCalledWith({ caption: "Already there" })
    expect(onCaptionChange.mock.calls[0]?.[0]).not.toHaveProperty("spec")
  })

  it("never rewrites the spec while mirroring a caption the spec itself supplied", async () => {
    const { onCaptionChange, rerenderWithCaption } = renderCaptionField(specWith("From the spec"))

    rerenderWithCaption("From the spec")
    await waitFor(() => expect(captionValue()).toBe("From the spec"))

    for (const [change] of onCaptionChange.mock.calls) {
      expect(change).not.toHaveProperty("spec")
    }
  })

  it("updates the caption alone while the spec isn't valid JSON", () => {
    const { onCaptionChange } = renderCaptionField("{ not json", "")

    typeCaption("Typed while the spec is broken")

    expect(onCaptionChange).toHaveBeenCalledWith({ caption: "Typed while the spec is broken" })
  })

  it("updates the caption alone when the spec is JSON but not an object", () => {
    const { onCaptionChange } = renderCaptionField("[1, 2]", "")

    typeCaption("Array spec")

    expect(onCaptionChange).toHaveBeenCalledWith({ caption: "Array spec" })
  })
})
