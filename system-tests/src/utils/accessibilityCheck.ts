import AxeBuilder from "@axe-core/playwright"
import { CheckResult } from "axe-core"
import { Console } from "console"
import { Page } from "playwright"

export default async function accessibilityCheck(
  page: Page,
  contextName: string,
  axeSkip: string[] | undefined,
): Promise<void> {
  // force all console.group output to stderr
  const stdErrConsole = new Console(process.stderr)
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
  stdErrConsole.error()
  stdErrConsole.error(`Found ${resultsFiltered.length} accessibility errors in ${contextName}`)
  stdErrConsole.error()
  // https://www.deque.com/axe/core-documentation/api-documentation/#results-object
  resultsFiltered.forEach((violation, n) => {
    stdErrConsole.group(`Violation ${n + 1}\n-----------`)
    stdErrConsole.error(`Rule: ${violation.id}`)
    stdErrConsole.error(`Description: ${violation.description}`)
    stdErrConsole.error(`Impact: ${violation.impact}`)
    stdErrConsole.error(`Help: ${violation.help}`)
    stdErrConsole.error(`Help URL: ${violation.helpUrl}`)
    stdErrConsole.group("Affected DOM nodes:")
    violation.nodes // nodes is an array of all elements the rule tested
      .filter((o) => o.impact !== null) // the check passed for this element if impact is null
      .forEach((node, n) => {
        stdErrConsole.group(`Affected DOM node ${n + 1}`)
        stdErrConsole.error(`Impact: ${node.impact}`)
        stdErrConsole.error(`Node HTML: ${node.html}`)
        stdErrConsole.error(`Target: ${node.target}`)
        if (node.any.length > 0) {
          stdErrConsole.group("At least one of these need to pass:")
          displayChecksForNodes(node.any, stdErrConsole)
          stdErrConsole.groupEnd()
        }
        if (node.all.length > 0) {
          stdErrConsole.group("All of these need to pass:")
          displayChecksForNodes(node.all, stdErrConsole)
          stdErrConsole.groupEnd()
        }
        if (node.none.length > 0) {
          stdErrConsole.group("None of these can pass:")
          displayChecksForNodes(node.all, stdErrConsole)
          stdErrConsole.groupEnd()
        }
        stdErrConsole.error()
        stdErrConsole.groupEnd()
      })
    stdErrConsole.groupEnd()
    stdErrConsole.error("\n")
    stdErrConsole.groupEnd()
  })

  throw new Error(`Found ${resultsFiltered.length} accessibility errors in ${contextName}`)
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
