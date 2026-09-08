/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { useController } from "react-hook-form"

import { useChartHeightControl } from "../../../src/blocks/Chart/useChartHeightControl"

const MIN_HEIGHT = 120
const HEIGHT_LABEL = "height"

const SINGLE_VIEW = JSON.stringify({ mark: "bar" })
const MULTI_VIEW = JSON.stringify({ hconcat: [{ mark: "bar" }, { mark: "line" }] })

interface HarnessProps {
  spec?: string
  heightPx?: number
  heightIsAuto?: boolean
  onHeightChange: (heightPx: number) => void
  /** The height the chart reports rendering at, applied once on mount. */
  naturalHeightPx?: number
}

const HeightControl: React.FC<HarnessProps> = ({
  spec = SINGLE_VIEW,
  heightPx = 300,
  heightIsAuto = false,
  onHeightChange,
  naturalHeightPx,
}) => {
  const { boxHeightPx, heightFieldControl, reportNaturalHeight, commitHeight } =
    useChartHeightControl({ spec, heightPx, heightIsAuto, minHeightPx: MIN_HEIGHT, onHeightChange })
  const { field } = useController({ name: "height", control: heightFieldControl })
  React.useEffect(() => {
    if (naturalHeightPx !== undefined) {
      reportNaturalHeight(naturalHeightPx)
    }
    // The preview reports its height once it has drawn; re-reporting it is not what is under test.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalHeightPx])
  return (
    <>
      <span data-testid="box-height">{boxHeightPx}</span>
      <input
        aria-label={HEIGHT_LABEL}
        value={field.value ?? ""}
        onChange={(event) => field.onChange(event.target.value)}
      />
      <button type="button" onClick={() => commitHeight(boxHeightPx + 40)}>
        drag down
      </button>
      <button type="button" onClick={() => commitHeight(boxHeightPx - 1000)}>
        drag up
      </button>
    </>
  )
}

const boxHeight = () => screen.getByTestId("box-height").textContent

const heightField = () => screen.getByLabelText(HEIGHT_LABEL) as HTMLInputElement

const typeHeight = (value: string) => fireEvent.change(heightField(), { target: { value } })

const dragEdge = (direction: "down" | "up") =>
  fireEvent.click(screen.getByRole("button", { name: `drag ${direction}` }))

describe("useChartHeightControl", () => {
  it("shows a single-view chart at the height the block is set to", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(<HeightControl onHeightChange={onHeightChange} naturalHeightPx={900} />)

    expect(boxHeight()).toBe("300")
    expect(heightField().value).toBe("300")
  })

  it("shows a multi-view chart at its natural height while the height is automatic", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(
      <HeightControl
        spec={MULTI_VIEW}
        heightIsAuto
        naturalHeightPx={640}
        onHeightChange={onHeightChange}
      />,
    )

    expect(boxHeight()).toBe("640")
    expect(heightField().value).toBe("640")
    // Mirroring the displayed height into the field must not count as the teacher choosing one.
    expect(onHeightChange).not.toHaveBeenCalled()
  })

  it("treats a spec that isn't valid JSON as single-view rather than breaking", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(
      <HeightControl spec="{ not json" naturalHeightPx={900} onHeightChange={onHeightChange} />,
    )

    expect(boxHeight()).toBe("300")
  })

  it("commits a height typed into the field", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(<HeightControl onHeightChange={onHeightChange} />)

    typeHeight("450")

    expect(onHeightChange).toHaveBeenCalledWith(450)
  })

  it("rounds a fractional typed height to whole pixels", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(<HeightControl onHeightChange={onHeightChange} />)

    typeHeight("450.7")

    expect(onHeightChange).toHaveBeenCalledWith(450)
  })

  it("ignores a height below the minimum while it is being typed", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(<HeightControl onHeightChange={onHeightChange} />)

    // Clearing the field to retype it passes through values that are too small.
    typeHeight("4")
    typeHeight("")

    expect(onHeightChange).not.toHaveBeenCalled()
  })

  it("commits a drag of the block's edge, measured from what is displayed", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(
      <HeightControl
        spec={MULTI_VIEW}
        heightIsAuto
        naturalHeightPx={640}
        onHeightChange={onHeightChange}
      />,
    )

    dragEdge("down")

    expect(onHeightChange).toHaveBeenCalledWith(680)
  })

  it("never commits a height below the minimum, however far the edge is dragged up", () => {
    const onHeightChange = jest.fn<(heightPx: number) => void>()
    render(<HeightControl onHeightChange={onHeightChange} />)

    dragEdge("up")

    expect(onHeightChange).toHaveBeenCalledWith(MIN_HEIGHT)
  })
})
