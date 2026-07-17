import { ServerResponse } from "http"
import { WritableStream } from "stream/web"
import { TextEncoder } from "util"

import { jest } from "@jest/globals"
import "@testing-library/jest-dom"

global.TextEncoder = TextEncoder
global.Response = ServerResponse
// oxlint-disable-next-line typescript/no-extraneous-class -- Web API polyfill; must be a class for new/instanceof
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = input
    this.method = init.method || "GET"
    this.headers = new Headers(init.headers)
  }
}

// oxlint-disable-next-line typescript/no-extraneous-class, max-classes-per-file -- colocated Web API / test-mock polyfills in one setup file; must be classes for new/instanceof
global.TransformStream = class TransformStream {
  constructor() {
    this.readable = {}
    this.writable = {}
  }
}

if (!global.WritableStream) {
  global.WritableStream = WritableStream
}

global.BroadcastChannel = class BroadcastChannel {
  constructor(channel) {
    this.channel = channel
  }
  postMessage(_message) {
    // NOP
  }
  addEventListener(_type, _listener) {
    // NOP
  }
  removeEventListener(_type, _listener) {
    // NOP
  }
  close() {
    // NOP
  }
}

global.jest = jest

// Mock IntersectionObserver for tests
const instances = new Set()
const elementToObserver = new Map()

class MockIntersectionObserver {
  constructor(callback, options = {}) {
    this.callback = callback
    this.options = options
    this.root = options?.root ?? null
    this.rootMargin = options?.rootMargin ?? "0px 0px 0px 0px"
    this.scrollMargin = options?.scrollMargin ?? "0px 0px 0px 0px"
    this.thresholds = Array.isArray(options?.threshold)
      ? options.threshold.slice().toSorted((a, b) => a - b)
      : [options?.threshold ?? 0]
    this.elements = new Set()
    instances.add(this)
  }

  observe(el) {
    this.elements.add(el)
    elementToObserver.set(el, this)
  }

  unobserve(el) {
    this.elements.delete(el)
    elementToObserver.delete(el)
  }

  disconnect() {
    this.elements.forEach((el) => elementToObserver.delete(el))
    this.elements.clear()
    instances.delete(this)
  }

  takeRecords() {
    return []
  }
}

global.IntersectionObserver = MockIntersectionObserver
global.window.IntersectionObserver = MockIntersectionObserver

// oxlint-disable-next-line unicorn/no-object-as-default-parameter -- default applies only when opts is fully omitted; no partial-merge confusion here
global.triggerIntersection = (el, opts = { isIntersecting: true, intersectionRatio: 1 }) => {
  const inst = elementToObserver.get(el)
  if (!inst) {
    throw new Error("No observer registered for element")
  }

  const entry = {
    time: opts.time ?? 0,
    target: el,
    isIntersecting: opts.isIntersecting,
    intersectionRatio: opts.intersectionRatio ?? (opts.isIntersecting ? 1 : 0),
    boundingClientRect: opts.boundingClientRect ?? el.getBoundingClientRect?.() ?? {},
    rootBounds: opts.rootBounds ?? null,
    intersectionRect: opts.intersectionRect ?? {},
  }

  inst.callback([entry], inst)
}
