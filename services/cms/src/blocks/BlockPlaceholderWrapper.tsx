"use client"

import { useBlockProps } from "@wordpress/block-editor"
import type { IconType } from "@wordpress/components"
import { Placeholder } from "@wordpress/components"
import React from "react"

import { includeIf } from "@/shared-module/common/utils/nullability"

/**
 * PlaceholderWrapper used by blocks that do not allow editing directly, i.e. no nested blocks.
 * Uses Gutenberg's native Placeholder component for consistent styling and a11y.
 *
 * Must be the outermost element the block's `edit` renders: it carries the block wrapper props
 * Gutenberg needs from apiVersion 2 onwards for selection, dragging and toolbar anchoring.
 */

interface BlockPlaceholderWrapperProps {
  title: string
  explanation: string
  icon?: IconType
  className?: string
}

const BlockPlaceholderWrapper: React.FC<React.PropsWithChildren<BlockPlaceholderWrapperProps>> = ({
  children,
  title,
  explanation,
  icon,
  className,
}) => {
  const blockProps = useBlockProps({ className })

  return (
    <div {...blockProps}>
      <Placeholder {...includeIf(icon, { icon })} label={title} instructions={explanation}>
        {children}
      </Placeholder>
    </div>
  )
}

export default BlockPlaceholderWrapper
