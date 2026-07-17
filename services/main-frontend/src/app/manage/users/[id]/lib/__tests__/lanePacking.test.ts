/// <reference types="jest" />

import type { LaneBox, LaneBoxInput, PackedPeriod } from "../lanePacking"
import { computeLaneBoxes, packLanes } from "../lanePacking"

const GAP = 16
const BASE_OPTS = {
  plotRightPx: 100_000,
  measureLabelPx: (s: string) => s.length * 7,
  maxLabelPx: 220,
  markerPadPx: 12,
  labelPadPx: 6,
}

/** Identity scale: treat the synthetic `ms` values directly as pixels. */
const identityMsToPx = (ms: number) => ms

/**
 * The core invariant: no two boxes assigned to the same lane may sit within `gap` px of each other.
 * Two boxes conflict when `a.start < b.end + gap && b.start < a.end + gap`.
 */
function assertNoLaneOverlap<T>(packed: PackedPeriod<T>[], gap: number): void {
  const byLane = new Map<number, PackedPeriod<T>[]>()
  for (const p of packed) {
    const lane = byLane.get(p.lane) ?? []
    lane.push(p)
    byLane.set(p.lane, lane)
  }
  for (const [lane, items] of byLane) {
    const sorted = items.toSorted((a, b) => a.start - b.start)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      const cur = sorted[i]!
      const separated = prev.end + gap <= cur.start
      if (!separated) {
        throw new Error(
          `lane ${lane}: boxes overlap within gap ${gap}: ` +
            `[${prev.start},${prev.end}] and [${cur.start},${cur.end}]`,
        )
      }
    }
  }
}

/** Convenience: compute pixel boxes then pack them. */
function packBoxes<T>(
  inputs: LaneBoxInput<T>[],
  opts: Partial<typeof BASE_OPTS> & { msToPx?: (ms: number) => number } = {},
): { boxes: LaneBox<T>[]; packed: PackedPeriod<LaneBox<T>["item"]>[]; laneCount: number } {
  const { msToPx = identityMsToPx, ...rest } = opts
  const boxes = computeLaneBoxes(inputs, { ...BASE_OPTS, ...rest, msToPx })
  const { packed, laneCount } = packLanes(boxes, GAP)
  return { boxes, packed, laneCount }
}

const point = <T>(key: string, ms: number, label: string, item: T): LaneBoxInput<T> => ({
  key,
  startMs: ms,
  endMs: ms,
  label,
  item,
})

const span = <T>(
  key: string,
  startMs: number,
  endMs: number,
  label: string,
  item: T,
): LaneBoxInput<T> => ({ key, startMs, endMs, label, item })

describe("lanePacking", () => {
  describe("packLanes", () => {
    it("keeps overlapping periods in separate lanes and reuses lanes for gapped ones", () => {
      const { packed, laneCount } = packLanes(
        [
          { start: 0, end: 10, item: "a" },
          { start: 5, end: 15, item: "b" },
          { start: 40, end: 50, item: "c" },
        ],
        GAP,
      )
      const laneOf = (item: string) => packed.find((p) => p.item === item)!.lane
      expect(laneOf("a")).not.toBe(laneOf("b"))
      // c is > GAP after a ended, so it reuses a's lane.
      expect(laneOf("c")).toBe(laneOf("a"))
      expect(laneCount).toBe(2)
    })

    it("stays backward compatible with keyless LanePeriod inputs", () => {
      const { packed } = packLanes([{ start: 0, end: 5, item: 1 }], GAP)
      expect(packed[0]?.lane).toBe(0)
    })
  })

  // 1. No-overlap invariant across representative inputs.
  describe("no-overlap invariant", () => {
    it("holds for a dense mix of points and spans with long labels", () => {
      const inputs = [
        span("a", 0, 30, "A course with a fairly long descriptive name", "a"),
        point("b", 10, "Another quite long course label here", "b"),
        span("c", 20, 40, "Short", "c"),
        point("d", 45, "Yet another long label to reserve space", "d"),
        span("e", 5, 60, "Middle length label", "e"),
        point("f", 62, "Tail", "f"),
      ]
      const { packed } = packBoxes(inputs)
      assertNoLaneOverlap(packed, GAP)
    })
  })

  // 2. Label-driven conflict: long labels force separate lanes; short labels share once the gap clears.
  describe("label-driven conflict", () => {
    it("splits two nearby points with long labels but merges them with short labels", () => {
      const longLabel = "This is a very long course name indeed"
      const long = packBoxes([point("a", 0, longLabel, "a"), point("b", 100, longLabel, "b")])
      expect(long.laneCount).toBe(2)
      assertNoLaneOverlap(long.packed, GAP)

      const short = packBoxes([point("a", 0, "AI", "a"), point("b", 100, "AI", "b")])
      expect(short.laneCount).toBe(1)
      assertNoLaneOverlap(short.packed, GAP)
    })
  })

  // 3. A short interval whose label overruns a later item's start must not share its lane.
  describe("label wider than interval", () => {
    it("keeps a later course out of the lane when the earlier label overruns it", () => {
      const { packed, laneCount } = packBoxes([
        span("a", 0, 10, "An overrunning label that is much wider than its ten-unit span", "a"),
        point("b", 50, "B", "b"),
      ])
      expect(laneCount).toBe(2)
      const laneOf = (k: string) => packed.find((p) => p.key === k)!.lane
      expect(laneOf("a")).not.toBe(laneOf("b"))
      assertNoLaneOverlap(packed, GAP)
    })
  })

  // 4. Marker overhang alone (gap 0) pushes the box end past scale(end) and blocks lane reuse.
  describe("marker overhang", () => {
    it("prevents an item starting inside the marker pad from sharing the lane", () => {
      const inputs = [span("a", 0, 100, "AI", "a"), point("b", 105, "B", "b")]
      // With markerPadPx=12 the box for a ends at 112, so b at 105 conflicts even with gap 0.
      const withPad = packLanes(
        computeLaneBoxes(inputs, { ...BASE_OPTS, msToPx: identityMsToPx }),
        0,
      )
      expect(withPad.laneCount).toBe(2)

      // Without the marker pad the box would end at 100 and b at 105 could reuse the lane.
      const noPad = packLanes(
        computeLaneBoxes(inputs, { ...BASE_OPTS, markerPadPx: 0, msToPx: identityMsToPx }),
        0,
      )
      expect(noPad.laneCount).toBe(1)
    })

    it("reserves marker overhang left of the span start (no-activity diamond / leading dot)", () => {
      // The box starts markerPad (12) left of the span start, mirroring the overhang past the end.
      const boxA = packBoxes([point("a", 50, "A", "a")]).boxes[0]!
      expect(boxA.start).toBe(boxA.spanStartPx - BASE_OPTS.markerPadPx)

      // b's left overhang (135 - 12 = 123 < a.end 112 + gap 16) keeps it off a's lane, though its raw
      // point (135) clears a's right edge by more than the gap.
      expect(packBoxes([span("a", 0, 100, "AI", "a"), point("b", 135, "B", "b")]).laneCount).toBe(2)
    })
  })

  // 5. Boundary check for the `<=` reuse condition: exactly gap-away reuses, one px short does not.
  describe("abutting intervals", () => {
    it("shares a lane at exactly the gap boundary but not one px inside it", () => {
      // a's box ends at 112 (span end 100 + markerPad 12); b's box starts 12 (markerPad) left of its
      // point, so the earliest reuse point is 112 + gap(16) + 12 = 140.
      const atBoundary = packBoxes([span("a", 0, 100, "AI", "a"), point("b", 140, "B", "b")])
      expect(atBoundary.laneCount).toBe(1)

      const oneInside = packBoxes([span("a", 0, 100, "AI", "a"), point("b", 139, "B", "b")])
      expect(oneInside.laneCount).toBe(2)
    })
  })

  // 6. Right-edge flip: a near-edge label flips to grow leftward and can then collide with earlier items.
  describe("right-edge flip", () => {
    it("flips the label inward and conflicts with an item reaching into the leftward extension", () => {
      const plotRightPx = 200
      const { boxes, packed } = packBoxes(
        [
          point("a", 100, "A", "a"),
          point("b", 195, "A long label that runs off the right edge", "b"),
        ],
        { plotRightPx },
      )
      const boxB = boxes.find((x) => x.key === "b")!
      expect(boxB.labelFlipped).toBe(true)
      // The flipped box extends left of its marker.
      expect(boxB.start).toBeLessThan(boxB.spanStartPx)
      const laneOf = (k: string) => packed.find((p) => p.key === k)!.lane
      expect(laneOf("a")).not.toBe(laneOf("b"))
      assertNoLaneOverlap(packed, GAP)
    })

    it("does not flip labels comfortably inside the plot", () => {
      const { boxes } = packBoxes([point("a", 10, "A", "a")], { plotRightPx: 200 })
      expect(boxes[0]?.labelFlipped).toBe(false)
    })
  })

  // 7. Determinism: input order never affects lane assignment; identical input is deep-equal.
  describe("determinism and stability", () => {
    const inputs = [
      point("k1", 0, "Label one", "1"),
      point("k2", 0, "Label two", "2"), // same start as k1: key breaks the tie
      span("k3", 0, 20, "Label three", "3"),
      span("k4", 5, 25, "Label four", "4"),
      point("k5", 40, "Label five", "5"),
    ]

    it("produces identical lane assignment regardless of input order", () => {
      const laneMap = (order: LaneBoxInput<string>[]) => {
        const { packed } = packBoxes(order)
        return Object.fromEntries(packed.map((p) => [p.key, p.lane]))
      }
      const reference = laneMap(inputs)
      const shuffled = [inputs[3]!, inputs[0]!, inputs[4]!, inputs[2]!, inputs[1]!]
      expect(laneMap(shuffled)).toEqual(reference)
    })

    it("returns deep-equal output for identical input", () => {
      expect(packBoxes(inputs).packed).toEqual(packBoxes(inputs).packed)
    })

    it("keeps equal-span periods in input order when keys are absent or duplicated", () => {
      // Equal start/end and equal (here absent) keys compare equal, so the stable sort keeps input
      // order — order-independence only holds for distinct keys. First-listed takes the first lane.
      const keyless = [
        { start: 0, end: 10, item: "first" },
        { start: 0, end: 10, item: "second" },
      ]

      const forward = packLanes(keyless, GAP).packed
      const forwardLane = (item: string) => forward.find((p) => p.item === item)!.lane
      expect(forwardLane("first")).toBe(0)
      expect(forwardLane("second")).toBe(1)

      // Reversing the input reverses the assignment: without distinct keys, order is not independent.
      const reversed = packLanes([keyless[1]!, keyless[0]!], GAP).packed
      const reversedLane = (item: string) => reversed.find((p) => p.item === item)!.lane
      expect(reversedLane("first")).toBe(1)
      expect(reversedLane("second")).toBe(0)
    })
  })

  // 8. Lane-count optimality: k mutually overlapping items require exactly k lanes.
  describe("lane-count optimality", () => {
    it("uses exactly k lanes for k mutually overlapping items", () => {
      const k = 7
      const inputs = Array.from({ length: k }, (_, i) => span(`k${i}`, 0, 1000, "Overlap", i))
      expect(packBoxes(inputs).laneCount).toBe(k)
    })
  })

  // 9. Regression fixtures distilled from two real production payloads.
  describe("production regression fixtures", () => {
    interface FixtureEntry {
      label: string
      start: string
      end?: string // absent => point / no-activity diamond (endMs = startMs)
    }

    const buildFixtureBoxes = (entries: FixtureEntry[]) => {
      const inputs: LaneBoxInput<string>[] = entries.map((e, i) => ({
        key: `${i}:${e.label}`,
        startMs: Date.parse(e.start),
        endMs: e.end ? Date.parse(e.end) : Date.parse(e.start),
        label: e.label,
        item: e.label,
      }))
      const min = Math.min(...inputs.map((i) => i.startMs))
      const max = Math.max(...inputs.map((i) => i.endMs))
      const PLOT_PX = 1160
      const msToPx = (ms: number) => ((ms - min) / (max - min)) * PLOT_PX
      const boxes = computeLaneBoxes(inputs, {
        msToPx,
        plotRightPx: PLOT_PX,
        measureLabelPx: (s) => s.length * 7,
        maxLabelPx: 220,
        markerPadPx: 12,
        labelPadPx: 6,
      })
      const { packed, laneCount } = packLanes(boxes, GAP)
      return { boxes, packed, laneCount, PLOT_PX }
    }

    const fixtureA: FixtureEntry[] = [
      { label: "Intro to Botany", start: "2026-06-15T15:07:55Z", end: "2026-06-16T08:17:04Z" },
      { label: "Intro to Zoology", start: "2026-06-16T08:27:13Z", end: "2026-06-16T09:56:00Z" },
      { label: "Data and Ethics", start: "2026-06-16T10:03:19Z", end: "2026-06-25T12:58:32Z" },
      {
        label: "Foundations of Digital Culture: an Overview 2025-2026",
        start: "2026-06-16T10:10:29Z",
      },
      { label: "Net MOOC", start: "2026-06-16T10:13:41Z", end: "2026-06-20T00:00:00Z" },
      { label: "Weather.now", start: "2026-06-16T10:14:31Z" },
      {
        label: "Modelling Techniques for Coastal Water Systems",
        start: "2026-06-18T17:41:00Z",
        end: "2026-06-22T09:56:10Z",
      },
      { label: "Applied Robotics", start: "2026-06-18T20:18:05Z", end: "2026-06-20T00:00:00Z" },
      {
        label: "Yleistietoa uusille opiskelijoille",
        start: "2026-06-18T22:55:28Z",
        end: "2026-06-25T21:49:16Z",
      },
      {
        label: "Explore Modern Pedagogy",
        start: "2026-06-19T12:17:26Z",
        end: "2026-06-28T15:45:52Z",
      },
      { label: "GlobalSystems.now", start: "2026-06-19T12:25:15Z" },
      { label: "Cloud Systems with Containers", start: "2026-06-19T12:53:14Z" },
      {
        label: "Introduction to Green Systems 2025",
        start: "2026-06-19T12:59:03Z",
        end: "2026-06-22T12:01:44Z",
      },
      {
        label: "Ecosystems.now 2025",
        start: "2026-06-19T13:00:22Z",
        end: "2026-06-25T06:13:52Z",
      },
      {
        label: "BUS-003: Basics of Business - How to Launch and Grow a Startup",
        start: "2026-06-19T13:06:16Z",
        end: "2026-06-20T21:10:00Z",
      },
      { label: "Weather.now 2025", start: "2026-06-19T13:06:20Z", end: "2026-06-24T12:59:08Z" },
      {
        label: "BUS-005: Value Proposition Canvas - build your venture",
        start: "2026-06-19T13:08:25Z",
        end: "2026-06-20T00:00:00Z",
      },
      {
        label: "Computational Signal Processing",
        start: "2026-06-19T13:09:48Z",
        end: "2026-06-23T08:01:21Z",
      },
      {
        label: "Yleistieteen MOOC, kevät 2026",
        start: "2026-06-19T16:21:13Z",
        end: "2026-06-20T17:28:49Z",
      },
      {
        label: "Johdatus yleistieteeseen ja tieteelliseen ajatteluun",
        start: "2026-06-19T16:22:10Z",
        end: "2026-07-10T10:00:45Z",
      },
      {
        label: "Johdatus peruslaskentaan",
        start: "2026-06-19T16:23:17Z",
        end: "2026-06-26T09:12:27Z",
      },
      {
        label: "Käyttäjälähtöinen suunnittelu ohjelmistoissa",
        start: "2026-06-19T16:47:55Z",
        end: "2026-06-20T12:39:43Z",
      },
      {
        label: "Introduction to Distributed Systems MOOC (2025-2026)",
        start: "2026-06-19T16:48:40Z",
        end: "2026-06-22T09:16:16Z",
      },
      { label: "Introduction to Green Systems", start: "2026-06-19T16:49:30Z" },
      { label: "Yleistieteen MOOC", start: "2026-06-22T05:56:48Z" },
      {
        label: "Introduction to Distributed Systems MOOC (2025 - 2026) - Chapter Exercises",
        start: "2026-06-22T09:20:05Z",
        end: "2026-06-25T00:00:00Z",
      },
      { label: "Introduction to Distributed Systems", start: "2026-07-15T20:30:57Z" },
    ]

    const fixtureB: FixtureEntry[] = [
      {
        label: "Explore Modern Pedagogy",
        start: "2026-06-07T16:13:03Z",
        end: "2026-07-09T04:05:47Z",
      },
      { label: "Introduction to Green Systems", start: "2026-06-07T16:14:53Z" },
      {
        label: "Introduction to Green Systems 2025",
        start: "2026-06-07T16:14:59Z",
        end: "2026-07-02T11:02:42Z",
      },
      { label: "GlobalSystems.now", start: "2026-06-07T22:45:17Z", end: "2026-07-07T10:11:12Z" },
      {
        label: "Introduction to Distributed Systems MOOC (2025 - 2026) - Chapter Exercises",
        start: "2026-06-11T23:44:06Z",
      },
      {
        label: "Introduction to Distributed Systems MOOC (2024 - 2025)",
        start: "2026-06-11T23:44:26Z",
      },
      {
        label: "Introduction to Distributed Systems MOOC (2025-2026)",
        start: "2026-06-11T23:44:56Z",
        end: "2026-06-19T00:00:00Z",
      },
      { label: "Applied Robotics", start: "2026-06-12T00:24:24Z", end: "2026-06-16T04:43:25Z" },
      { label: "Weather.now", start: "2026-06-12T00:27:13Z" },
      { label: "Weather.now 2025", start: "2026-06-12T00:27:21Z", end: "2026-07-03T00:33:16Z" },
      { label: "Ecosystems.now", start: "2026-06-12T00:28:39Z" },
      {
        label: "Ecosystems.now 2025",
        start: "2026-06-12T00:28:45Z",
        end: "2026-07-07T13:16:25Z",
      },
      { label: "Net MOOC", start: "2026-06-12T00:30:39Z", end: "2026-06-15T00:00:00Z" },
      { label: "Cloud Ops with Docker, Spring 2026", start: "2026-06-12T00:42:28Z" },
      { label: "Data and Ethics", start: "2026-06-12T00:44:06Z", end: "2026-07-07T14:51:50Z" },
      { label: "Intro to Zoology", start: "2026-06-12T00:46:58Z", end: "2026-07-07T19:58:54Z" },
      { label: "Grundkurs MOOC", start: "2026-06-12T00:50:34Z" },
      {
        label: "Grundkurs MOOC, vår 2026",
        start: "2026-06-12T00:50:41Z",
        end: "2026-06-16T16:18:32Z",
      },
      { label: "Intro to Botany", start: "2026-06-12T00:51:16Z", end: "2026-07-07T21:50:10Z" },
      { label: "Cloud Systems with Containers", start: "2026-06-17T23:52:30Z" },
      {
        label: "Käyttäjälähtöinen suunnittelu ohjelmistoissa",
        start: "2026-06-17T23:55:09Z",
      },
      {
        label: "Johdatus yleistieteeseen ja tieteelliseen ajatteluun",
        start: "2026-06-17T23:55:30Z",
      },
      { label: "Yleistietoa uusille opiskelijoille", start: "2026-06-17T23:55:42Z" },
    ]

    it("holds the no-overlap invariant for fixture A", () => {
      const { packed } = buildFixtureBoxes(fixtureA)
      assertNoLaneOverlap(packed, GAP)
    })

    it("holds the no-overlap invariant for fixture B", () => {
      const { packed } = buildFixtureBoxes(fixtureB)
      assertNoLaneOverlap(packed, GAP)
    })

    it("keeps every fixture-A box within reasonable plot bounds", () => {
      const { boxes, PLOT_PX } = buildFixtureBoxes(fixtureA)
      for (const box of boxes) {
        expect(box.start).toBeGreaterThanOrEqual(-BASE_OPTS.maxLabelPx)
        expect(box.end).toBeLessThanOrEqual(PLOT_PX + BASE_OPTS.maxLabelPx + BASE_OPTS.markerPadPx)
        expect(box.labelWidthPx).toBeLessThanOrEqual(BASE_OPTS.maxLabelPx)
      }
    })

    it("flips the near-right-edge label in fixture A", () => {
      const { boxes } = buildFixtureBoxes(fixtureA)
      const nearEdge = boxes.find((b) => b.item === "Introduction to Distributed Systems")!
      expect(nearEdge.labelFlipped).toBe(true)
    })

    // Regression: a no-activity diamond with a wide label used to collide with a later span's label.
    it("does not let the wide no-activity label collide with the later span", () => {
      const { packed } = buildFixtureBoxes(fixtureA)
      const diamond = packed.find(
        (p) => p.item === "Foundations of Digital Culture: an Overview 2025-2026",
      )!
      const later = packed.find((p) => p.item === "Yleistietoa uusille opiskelijoille")!
      if (diamond.lane === later.lane) {
        const separated = diamond.end + GAP <= later.start || later.end + GAP <= diamond.start
        expect(separated).toBe(true)
      } else {
        expect(diamond.lane).not.toBe(later.lane)
      }
    })
  })
})
