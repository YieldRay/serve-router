import { test } from "node:test"
import * as assert from "node:assert"
import http from "node:http"
import { d2n, incoming2request, response4server } from "../src/node/index.ts"

// Node adapter unit tests without opening ports

test("incoming2request builds correct Request", () => {
    const req = new http.IncomingMessage(null as any)
    req.method = "POST"
    req.url = "/path?x=1"
    ;(req as any).socket = {
        remoteAddress: "127.0.0.1",
        remotePort: 1234,
        address: () => ({ address: "localhost" })
    }
    req.headers = { host: "example.com", "content-type": "application/json" }

    const webReq = incoming2request(req)
    assert.equal(webReq.method, "POST")
    assert.equal(new URL(webReq.url).href, "http://example.com/path?x=1")
})

test("response4server writes status/headers/body", async () => {
    // create a mock ServerResponse
    const res = new http.ServerResponse({} as any)
    // patch methods used
    const headers: Record<string, string | string[]> = {}
    ;(res as any).setHeader = (k: string, v: any) => { headers[k.toLowerCase()] = v }
    ;(res as any).getHeader = (k: string) => headers[k.toLowerCase()]
    ;(res as any).hasHeader = (k: string) => k.toLowerCase() in headers
    let body = Buffer.alloc(0)
    ;(res as any).write = (chunk: any) => { body = Buffer.concat([body, Buffer.from(chunk)]) ; return true }
    let ended!: () => void
    const endedP = new Promise<void>((r) => (ended = r))
    ;(res as any).end = () => { ended() }

    const r = new Response("hi", { status: 201, headers: { A: "1" } })
    const p = response4server(res, r)
    await Promise.all([p, endedP]) // wait for piping completion and end()

    assert.equal(res.statusCode, 201)
    assert.equal(headers["a"], "1")
    assert.equal(body.toString(), "hi")
})

test("d2n adapts handler", async () => {
    const handler = d2n(async () => new Response("ok"))
    // we won't actually .end() to a socket; just ensure it calls response4server without throwing
    const req = new http.IncomingMessage(null as any)
    ;(req as any).socket = { remoteAddress: "127.0.0.1", remotePort: 1, address: () => ({ address: "localhost" }) }
    req.method = "GET"
    req.url = "/"
    req.headers = { host: "ex" }

    const res = new http.ServerResponse(req)
    ;(res as any).end = () => {}
    await handler(req, res)
    assert.equal(res.statusCode, 200)
})
