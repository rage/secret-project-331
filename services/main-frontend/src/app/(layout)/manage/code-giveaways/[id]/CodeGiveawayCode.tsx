"use client"

import React from "react"

interface CodeGiveawayCodeProps {
  code: string
  revealed: boolean
}

const CodeGiveawayCode: React.FC<CodeGiveawayCodeProps> = ({ code, revealed }) => {
  return <code>{revealed ? code : "******"}</code>
}

export default CodeGiveawayCode
