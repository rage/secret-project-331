import { cloneBlock, createBlock } from "@wordpress/blocks"

import type { BlockInstance } from "@/utils/Gutenberg/types"

import { resolveAsideHeadingLevel } from "./AsideWithImage/headingLevel"
import { EXPANDABLE_SECTION_ALLOWED_BLOCKS } from "./ExpandableContent/ExpandableContentInnerBlock/allowedBlocks"

const INFOBOX = "moocfi/infobox"
const ASIDE = "moocfi/aside"
const ASIDE_WITH_IMAGE = "moocfi/aside-with-image"
const EXPANDABLE = "moocfi/expandable-content"
const EXPANDABLE_SECTION = "moocfi/expandable-content-inner-block"

/** The course material renders expandable section titles as h4. */
const EXPANDABLE_TITLE_LEVEL = 4

interface BlockTransform {
  type: "block"
  blocks: string[]
  isMatch?: (attributes: unknown, block: BlockInstance | BlockInstance[]) => boolean
  // Gutenberg types the arguments as unknown; they are the source block's attributes and inner blocks.
  transform: (attributes: unknown, innerBlocks: unknown) => BlockInstance
}

const textToHtml = (text: string) => {
  const element = document.createElement("span")
  element.textContent = text
  return element.innerHTML
}

// An inert document, so markup such as <img onerror> in the content cannot run.
const htmlToText = (html: unknown) =>
  new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent?.trim() ?? ""

const cloneAll = (blocks: BlockInstance[]) => blocks.map((block) => cloneBlock(block))

const heading = (level: number, html: string) =>
  createBlock("core/heading", { level, content: html })

/** The source's content as plain blocks, which the boxes that take any block accept. */
function contentAsBlocks(
  sourceName: string,
  attributes: Record<string, unknown>,
  innerBlocks: BlockInstance[],
): BlockInstance[] {
  switch (sourceName) {
    case EXPANDABLE:
      return innerBlocks.flatMap((section) => {
        const name = String(section.attributes.name ?? "").trim()
        return [
          ...(name === "" ? [] : [heading(EXPANDABLE_TITLE_LEVEL, textToHtml(name))]),
          ...cloneAll(section.innerBlocks),
        ]
      })
    case ASIDE_WITH_IMAGE:
      return [
        ...(htmlToText(attributes.title) === ""
          ? []
          : [heading(resolveAsideHeadingLevel(attributes.headingLevel), String(attributes.title))]),
        ...cloneAll(innerBlocks),
        ...(htmlToText(attributes.content) === ""
          ? []
          : [createBlock("core/paragraph", { content: String(attributes.content) })]),
      ]
    default:
      return cloneAll(innerBlocks)
  }
}

/** Each heading starts a section titled by it, so expandable → box → expandable round-trips. */
function blocksAsSections(blocks: BlockInstance[]): BlockInstance[] {
  const sections: { name: string; blocks: BlockInstance[] }[] = []
  for (const block of blocks) {
    if (block.name === "core/heading") {
      sections.push({ name: htmlToText(block.attributes.content), blocks: [] })
    } else if (sections.length === 0) {
      sections.push({ name: "", blocks: [cloneBlock(block)] })
    } else {
      sections.at(-1)?.blocks.push(cloneBlock(block))
    }
  }
  if (sections.length === 0) {
    sections.push({ name: "", blocks: [] })
  }
  return sections.map((section) =>
    createBlock(EXPANDABLE_SECTION, { name: section.name }, section.blocks),
  )
}

const toAnyContentBox = (target: string, sources: string[]): BlockTransform[] =>
  sources.map((source) => ({
    type: "block",
    blocks: [source],
    transform: (attributes, innerBlocks) =>
      createBlock(
        target,
        {},
        contentAsBlocks(
          source,
          attributes as Record<string, unknown>,
          innerBlocks as BlockInstance[],
        ),
      ),
  }))

const CONTAINER_TRANSFORMS: Record<string, BlockTransform[]> = {
  [INFOBOX]: toAnyContentBox(INFOBOX, [ASIDE, EXPANDABLE, ASIDE_WITH_IMAGE]),
  [ASIDE]: toAnyContentBox(ASIDE, [INFOBOX, EXPANDABLE, ASIDE_WITH_IMAGE]),
  [EXPANDABLE]: [
    {
      type: "block",
      blocks: [INFOBOX, ASIDE],
      // Offered only when nothing would be dropped by the sections' allowed blocks.
      isMatch: (_attributes, block) =>
        !Array.isArray(block) &&
        block.innerBlocks.every((inner) => EXPANDABLE_SECTION_ALLOWED_BLOCKS.includes(inner.name)),
      transform: (_attributes, innerBlocks) =>
        createBlock(EXPANDABLE, {}, blocksAsSections(innerBlocks as BlockInstance[])),
    },
  ],
}

/**
 * "Transform to" options that turn another content container (info box, aside, aside with image,
 * expandable content) into `target`, keeping its content. Goes in the target block's
 * `transforms.from`.
 */
export const containerTransformsTo = (target: string): BlockTransform[] =>
  CONTAINER_TRANSFORMS[target] ?? []
