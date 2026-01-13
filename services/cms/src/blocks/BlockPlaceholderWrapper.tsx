"use client"
import { useBlockProps } from "@wordpress/block-editor"
import { IconType, Placeholder } from "@wordpress/components"
import React from "react"

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
      // eslint-disable-next-line i18next/no-literal-string
      {...(id ? { id: `placeholder-block-${id}` } : {})}
    >
      <Placeholder icon={icon} label={title} instructions={explanation}>
        {children}
      </Placeholder>
    </div>
  )
}

export default BlockPlaceholderWrapper
