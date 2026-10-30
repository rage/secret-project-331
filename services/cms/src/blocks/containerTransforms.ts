import { cloneBlock, createBlock } from "@wordpress/blocks"
import { escape } from "lodash"

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
  // Gutenberg's types cover multi-block transforms; these are single-block, so `block` is one block.
  isMatch?: (attributes: unknown, block: BlockInstance | BlockInstance[]) => boolean
  transform: (attributes: unknown, innerBlocks: unknown) => BlockInstance
}

// An inert document, so markup such as <img onerror> in the content cannot run.
const htmlToText = (html: unknown) =>
  new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent?.trim() ?? ""

const cloneAll = (blocks: BlockInstance[]) => blocks.map((block) => cloneBlock(block))

const heading = (level: number, html: string) =>
  createBlock("core/heading", { level, content: html })

const isHeading = (block: BlockInstance) => block.name === "core/heading"

const shallowestHeadingLevel = (blocks: BlockInstance[]) =>
  Math.min(
    ...blocks.filter((block) => isHeading(block)).map((block) => Number(block.attributes.level)),
  )

/** Section titles must sit above the headings inside the sections for the content to split back. */
function sectionTitleLevel(sections: BlockInstance[]) {
  const innerLevel = shallowestHeadingLevel(sections.flatMap((section) => section.innerBlocks))
  return Math.max(2, Math.min(EXPANDABLE_TITLE_LEVEL, innerLevel - 1))
}

/** The source's content as plain blocks, which the boxes that take any block accept. */
function contentAsBlocks(
  sourceName: string,
  attributes: Record<string, unknown>,
  innerBlocks: BlockInstance[],
): BlockInstance[] {
  switch (sourceName) {
    case EXPANDABLE: {
      const titleLevel = sectionTitleLevel(innerBlocks)
      return innerBlocks.flatMap((section) => {
        const name = String(section.attributes.name ?? "").trim()
        return [
          ...(name === "" ? [] : [heading(titleLevel, escape(name))]),
          ...cloneAll(section.innerBlocks),
        ]
      })
    }
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

/**
 * Each heading of the shallowest level starts a section titled by its text; deeper headings stay
 * inside the sections. Content before the first such heading becomes an untitled section.
 */
function blocksAsSections(blocks: BlockInstance[]): BlockInstance[] {
  const titleLevel = shallowestHeadingLevel(blocks)
  const sections: { name: string; blocks: BlockInstance[] }[] = []
  for (const block of blocks) {
    if (isHeading(block) && Number(block.attributes.level) === titleLevel) {
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

/**
 * "Transform to" options on each content container (info box, aside, expandable content) that
 * turn the other containers, and aside with image, into it, keeping their content. They go in the
 * container's `transforms.from`.
 */
export const TRANSFORMS_TO_INFOBOX = toAnyContentBox(INFOBOX, [ASIDE, EXPANDABLE, ASIDE_WITH_IMAGE])

export const TRANSFORMS_TO_ASIDE = toAnyContentBox(ASIDE, [INFOBOX, EXPANDABLE, ASIDE_WITH_IMAGE])

export const TRANSFORMS_TO_EXPANDABLE: BlockTransform[] = [
  {
    type: "block",
    blocks: [INFOBOX, ASIDE],
    // A section would drop any other block.
    isMatch: (_attributes, block) =>
      (block as BlockInstance).innerBlocks.every((inner) =>
        EXPANDABLE_SECTION_ALLOWED_BLOCKS.includes(inner.name),
      ),
    transform: (_attributes, innerBlocks) =>
      createBlock(EXPANDABLE, {}, blocksAsSections(innerBlocks as BlockInstance[])),
  },
]
