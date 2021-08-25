import AxeBuilder from "@axe-core/playwright"
import { CheckResult } from "axe-core"
import { Page } from "playwright"

export default async function accessibilityCheck(page: Page, contextName: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  if (results.violations.length === 0) {
    return
  }
  console.error()
  console.error(`Found ${results.violations.length} accessibility errors in ${contextName}`)
  console.error()
  // https://www.deque.com/axe/core-documentation/api-documentation/#results-object
  results.violations.forEach((violation, n) => {
    console.group(`Violation ${n + 1}\n-----------`)
    console.error(`Rule: ${violation.id}`)
    console.error(`Description: ${violation.description}`)
    console.error(`Impact: ${violation.impact}`)
    console.error(`Help: ${violation.help}`)
    console.error(`Help URL: ${violation.helpUrl}`)
    console.group("Affected DOM nodes:")
    violation.nodes // nodes is an array of all elements the rule tested
      .filter((o) => o.impact !== null) // the check passed for this element if impact is null
      .forEach((node, n) => {
        console.group(`Affected DOM node ${n + 1}`)
        console.error(`Impact: ${node.impact}`)
        console.error(`Node HTML: ${node.html}`)
        console.error(`Target: ${node.target}`)
        if (node.any.length > 0) {
          console.group("At least one of these need to pass:")
          displayChecksForNodes(node.any)
          console.groupEnd()
        }
        if (node.all.length > 0) {
          console.group("All of these need to pass:")
          displayChecksForNodes(node.all)
          console.groupEnd()
        }
        if (node.none.length > 0) {
          console.group("None of these can pass:")
          displayChecksForNodes(node.all)
          console.groupEnd()
        }
        console.error()
        console.groupEnd()
      })
    console.groupEnd()
    console.error("\n")
    console.groupEnd()
  })
  throw new Error(`Found ${results.violations.length} accessibility errors.`)
}

function displayChecksForNodes(nodes: CheckResult[]): void {
  nodes.forEach((node, n) => {
    console.group(`Check ${n + 1}`)
    console.error(`Id: ${node.id}`)
    console.error(`Impact: ${node.impact}`)
    console.error(`Message: ${node.message}`)
    console.error(`Data: ${JSON.stringify(node.data, undefined, 2)}`)
    console.error(`Related nodes: ${JSON.stringify(node.relatedNodes, undefined, 2)}`)
    console.groupEnd()
  })
}
