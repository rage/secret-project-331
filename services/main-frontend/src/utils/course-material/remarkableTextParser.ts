// Modified from https://github.com/jonschlinkert/remarkable

// Skip text characters for text token, place those to pending buffer
// and increment current pos

import type { InlineParsingRule } from "remarkable/lib"

// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

function isTerminatorChar(ch: number) {
  switch (ch) {
    case 0x0a /* \n */:
    case 0x5c /* \ */:
    case 0x60 /* ` */:
    case 0x2a /* * */:
    case 0x5f /* _ */:
    case 0x5e /* ^ */:
    case 0x5b /* [ */:
    case 0x5d /* ] */:
    case 0x21 /* ! */:
    case 0x26 /* & */:
    case 0x3c /* < */:
    case 0x3e /* > */:
    case 0x7b /* { */:
    case 0x7d /* } */:
    case 0x24 /* $ */:
    case 0x25 /* % */:
    case 0x40 /* @ */:
    case 0x7e /* ~ */:
    case 0x2b /* + */:
    case 0x3d /* = */:
    case 0x3a /* : */:
    case 0x3010 /* 【 */:
    case 0x3011 /* 】 */:
      return true
    default:
      return false
  }
}

export const textParser: InlineParsingRule = (state, silent) => {
  var pos = state.pos

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++
  }

  if (pos === state.pos) {
    return false
  }

  if (!silent) {
    state.pending += state.src.slice(state.pos, pos)
  }

  state.pos = pos

  return true
}
