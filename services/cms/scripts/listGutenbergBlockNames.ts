// Require imports needs to happen in a specific order.
/* eslint-disable import/order */

import { Block } from "@wordpress/blocks"
import * as jsdom from "jsdom"
const { JSDOM } = jsdom

const dom = new JSDOM(`<body>
<script>document.body.appendChild(document.createElement("hr"));</script>
</body>`)
const mock = () => {
  // No op
}
Object.defineProperty(dom.window, "matchMedia", {
  writable: true,
  value: (query: unknown) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: mock, // deprecated
      removeListener: mock, // deprecated
      addEventListener: mock,
      removeEventListener: mock,
      dispatchEvent: mock,
    }
  },
})
// @ts-expect-error: Just to prevent a crash, not used
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
// @ts-expect-error: Just to prevent a crash, not used
global.CSS = {}

// The following import order matters and are dependant on above window definition.
const blockLibrary = require("@wordpress/block-library")
const blocks = require("@wordpress/blocks")

async function main() {
  blockLibrary.registerCoreBlocks()
  const allBlockInstances: Block<Record<string, unknown>>[] = blocks.getBlockTypes()
  const coreBlocks = allBlockInstances.map((block) => block.name)
  console.log("Gutenberg all Core block names:")
  console.log(coreBlocks)
  const embedBlocks = blocks
    .getBlockType("core/embed")
    .variations.map((block: Block<Record<string, unknown>>) => block.name)
  console.log("Gutenberg all core/embed names:")
  console.log(embedBlocks)
}
main()
