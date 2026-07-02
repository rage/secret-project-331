import {
  dataFormatForUrl,
  dataUrlFromSpec,
  extractInlineData,
  specWithDataUrl,
} from "../../../src/blocks/ChartBlock/chartSpec"

const specWith = (data: unknown): string => JSON.stringify({ mark: "bar", data })

describe("extractInlineData", () => {
  it("extracts an array of objects as a pretty-printed JSON file", () => {
    const values = [
      { category: "A", value: 1 },
      { category: "B", value: 2 },
    ]
    const result = extractInlineData(specWith({ values }))

    expect(result).not.toBeNull()
    expect(result?.extension).toBe("json")
    expect(result?.mime).toBe("application/json")
    expect(JSON.parse(result?.contents ?? "")).toEqual(values)
    // The original `data` key is dropped from the spec.
    expect(result?.specWithoutData).toEqual({ mark: "bar" })
  })

  it("extracts a CSV string and keeps the csv extension/mime", () => {
    const csv = "category,value\nA,1\nB,2"
    const result = extractInlineData(specWith({ values: csv, format: { type: "csv" } }))

    expect(result?.extension).toBe("csv")
    expect(result?.mime).toBe("text/plain")
    expect(result?.contents).toBe(csv)
  })

  it("extracts a TSV string and keeps the tsv extension", () => {
    const tsv = "category\tvalue\nA\t1"
    const result = extractInlineData(specWith({ values: tsv, format: { type: "tsv" } }))

    expect(result?.extension).toBe("tsv")
    expect(result?.mime).toBe("text/plain")
  })

  it("treats a string with no/unknown format as JSON", () => {
    const result = extractInlineData(specWith({ values: '[{"a":1}]' }))

    expect(result?.extension).toBe("json")
    expect(result?.mime).toBe("application/json")
  })

  it("returns null when there is no data key", () => {
    expect(extractInlineData(JSON.stringify({ mark: "bar" }))).toBeNull()
  })

  it("returns null when data is a URL reference rather than inline values", () => {
    expect(extractInlineData(specWith({ url: "/data.json" }))).toBeNull()
  })

  it("returns null for an empty array of values", () => {
    expect(extractInlineData(specWith({ values: [] }))).toBeNull()
  })

  it("returns null for an empty string of values", () => {
    expect(extractInlineData(specWith({ values: "" }))).toBeNull()
  })

  it("returns null when data.values is explicitly null", () => {
    expect(extractInlineData(specWith({ values: null }))).toBeNull()
  })

  it("returns null for unparseable JSON", () => {
    expect(extractInlineData("{ not json")).toBeNull()
  })
})

describe("dataFormatForUrl", () => {
  it("detects csv, tsv and json extensions", () => {
    expect(dataFormatForUrl("/files/data.csv")).toEqual({ type: "csv" })
    expect(dataFormatForUrl("/files/data.tsv")).toEqual({ type: "tsv" })
    expect(dataFormatForUrl("/files/data.json")).toEqual({ type: "json" })
  })

  it("ignores query parameters when sniffing the extension", () => {
    expect(dataFormatForUrl("https://cdn.example.com/data.csv?token=abc&v=2")).toEqual({
      type: "csv",
    })
  })

  it("is case insensitive", () => {
    expect(dataFormatForUrl("/DATA.CSV")).toEqual({ type: "csv" })
  })

  it("returns undefined for an unknown extension", () => {
    expect(dataFormatForUrl("/files/data.txt")).toBeUndefined()
  })
})

describe("specWithDataUrl", () => {
  it("points data at the url and infers the format from the extension", () => {
    const result = specWithDataUrl(JSON.stringify({ mark: "bar" }), "/files/data.csv")

    expect(result).toEqual({
      mark: "bar",
      data: { url: "/files/data.csv", format: { type: "csv" } },
    })
  })

  it("replaces any existing inline data", () => {
    const result = specWithDataUrl(specWith({ values: [{ a: 1 }] }), "/files/data.json")

    expect(result?.data).toEqual({ url: "/files/data.json", format: { type: "json" } })
  })

  it("omits the format when the extension is unknown", () => {
    const result = specWithDataUrl(JSON.stringify({ mark: "bar" }), "/files/data")

    expect(result).toEqual({ mark: "bar", data: { url: "/files/data" } })
  })

  it("returns null for unparseable JSON", () => {
    expect(specWithDataUrl("{ not json", "/files/data.csv")).toBeNull()
  })
})

describe("dataUrlFromSpec", () => {
  it("returns the data url when present", () => {
    expect(dataUrlFromSpec(specWith({ url: "/files/data.json" }))).toBe("/files/data.json")
  })

  it("returns undefined when data is inline values", () => {
    expect(dataUrlFromSpec(specWith({ values: [{ a: 1 }] }))).toBeUndefined()
  })

  it("returns undefined when there is no data", () => {
    expect(dataUrlFromSpec(JSON.stringify({ mark: "bar" }))).toBeUndefined()
  })

  it("returns undefined for unparseable JSON", () => {
    expect(dataUrlFromSpec("{ not json")).toBeUndefined()
  })
})
