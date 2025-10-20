"use client"
import React from "react"

interface SourceBlockProps {
  text: unknown
}

const SourceBlock: React.FC<SourceBlockProps> = ({ text }) => {
  const str = typeof text === "string" ? text : JSON.stringify(text, undefined, 2)
  const lines = str.split("\n")
  return (
    <pre>
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </pre>
  )
}

export default SourceBlock
