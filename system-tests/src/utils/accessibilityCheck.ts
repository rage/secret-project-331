import AxeBuilder from "@axe-core/playwright"
import { CheckResult } from "axe-core"
import { Console } from "console"
import { Page } from "playwright"
import { Writable } from "stream"

export default async function accessibilityCheck(
  page: Page,
  contextName: string,
  axeSkip: string[] | undefined,
): Promise<void> {
  // collect console.logs with all the console.group groupings
  const outputStream = new StoringStream()
  const customConsole = new Console(outputStream)
  const results = await new AxeBuilder({ page }).analyze()
  let resultsFiltered = []
  if (Array.isArray(axeSkip)) {
    resultsFiltered = results.violations.filter((violation) => {
      if (axeSkip.find((skippable) => skippable === violation.id)) {
        return
      } else {
        return violation
      }
    })
  } else {
    resultsFiltered = results.violations
  }
  if (resultsFiltered.length === 0) {
    return
  }
  customConsole.error(`Found ${resultsFiltered.length} accessibility errors in ${contextName}.`)
  customConsole.error()
  // https://www.deque.com/axe/core-documentation/api-documentation/#results-object
  resultsFiltered.forEach((violation, n) => {
    customConsole.group(`Violation ${n + 1}\n-----------`)
    customConsole.error(`Rule: ${violation.id}`)
    customConsole.error(`Description: ${violation.description}`)
    customConsole.error(`Impact: ${violation.impact}`)
    customConsole.error(`Help: ${violation.help}`)
    customConsole.error(`Help URL: ${violation.helpUrl}`)
    customConsole.group("Affected DOM nodes:")
    violation.nodes // nodes is an array of all elements the rule tested
      .filter((o) => o.impact !== null) // the check passed for this element if impact is null
      .forEach((node, n) => {
        customConsole.group(`Affected DOM node ${n + 1}`)
        customConsole.error(`Impact: ${node.impact}`)
        customConsole.error(`Node HTML: ${node.html}`)
        customConsole.error(`Target: ${node.target}`)
        if (node.any.length > 0) {
          customConsole.group("At least one of these need to pass:")
          displayChecksForNodes(node.any, customConsole)
          customConsole.groupEnd()
        }
        if (node.all.length > 0) {
          customConsole.group("All of these need to pass:")
          displayChecksForNodes(node.all, customConsole)
          customConsole.groupEnd()
        }
        if (node.none.length > 0) {
          customConsole.group("None of these can pass:")
          displayChecksForNodes(node.all, customConsole)
          customConsole.groupEnd()
        }
        customConsole.error()
        customConsole.groupEnd()
      })
    customConsole.groupEnd()
    customConsole.error("\n")
    customConsole.groupEnd()
  })

  throw new Error(outputStream.chunks.join(""))
}

function displayChecksForNodes(nodes: CheckResult[], stdErrConsole: Console): void {
  nodes.forEach((node, n) => {
    stdErrConsole.group(`Check ${n + 1}`)
    stdErrConsole.error(`Id: ${node.id}`)
    stdErrConsole.error(`Impact: ${node.impact}`)
    stdErrConsole.error(`Message: ${node.message}`)
    stdErrConsole.error(`Data: ${JSON.stringify(node.data, undefined, 2)}`)
    stdErrConsole.error(`Related nodes: ${JSON.stringify(node.relatedNodes, undefined, 2)}`)
    stdErrConsole.groupEnd()
  })
}

class StoringStream extends Writable {
  chunks: string[]

  constructor() {
    super()
    this.chunks = []
  }
  _write(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ): void {
    this.chunks.push(chunk.toString())
    callback()
  }
}
