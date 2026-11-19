"use client"

import React from "react"

import type { DialogApi } from "./dialogRequests"

/** Returns the API bound to a nesting depth. `null` outside a `DialogProvider`. */
export type DialogApiForDepth = ((depth: number) => DialogApi) | null

export const DialogApiContext = React.createContext<DialogApiForDepth>(null)

/** How many dialog bodies the reading component is inside of. 0 anywhere else in the tree. */
export const DialogDepthContext = React.createContext(0)
