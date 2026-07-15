"use client"

import { useBlockProps } from "@wordpress/block-editor"
import type { IconType } from "@wordpress/components"
import { Placeholder } from "@wordpress/components"
import React from "react"

import { includeIf } from "@/shared-module/common/utils/nullability"

/**
 * PlaceholderWrapper used by blocks that do not allow editing directly, i.e. no nested blocks.
 * Uses Gutenberg's native Placeholder component for consistent styling and a11y.
 */

interface BlockPlaceholderWrapperProps {
  id?: string
  title: string
  explanation: string
  icon?: IconType
  className?: string
}

const BlockPlaceholderWrapper: React.FC<React.PropsWithChildren<BlockPlaceholderWrapperProps>> = ({
  id,
  children,
  title,
  explanation,
  icon,
  className,
}) => {
  const blockProps = useBlockProps({ className })

  return (
    <div
      {...blockProps}
      // oxlint-disable-next-line i18next/no-literal-string
      {...includeIf(id, { id: `placeholder-block-${id}` })}
    >
      <Placeholder {...includeIf(icon, { icon })} label={title} instructions={explanation}>
        {children}
      </Placeholder>
    </div>
  )
}

export default BlockPlaceholderWrapper
