/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-var-requires */

import { BlockInstance } from "@wordpress/blocks"

const blockLibrary = require("@wordpress/block-library")
const blocks = require("@wordpress/blocks")
const jsdom = require("jsdom")

const { JSDOM } = jsdom
const dom = new JSDOM(`<body>
<script>document.body.appendChild(document.createElement("hr"));</script>
</body>`)
const mock = () => {}
Object.defineProperty(dom.window, "matchMedia", {
  writable: true,
  value: (query) => {
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
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator

async function main() {
  blockLibrary.registerCoreBlocks()
  const allBlockInstances: BlockInstance[] = blocks.getBlockTypes()
  const coreBlocks = allBlockInstances.map((block) => block.name)
  console.log("Gutenberg all Core block names:")
  console.log(coreBlocks)
  const embedBlocks = blocks.getBlockType("core/embed").variations.map((block) => block.name)
  console.log("Gutenberg all core/embed names:")
  console.log(embedBlocks)
}
main()
