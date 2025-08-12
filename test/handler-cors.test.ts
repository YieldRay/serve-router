import { test } from "node:test"
import * as assert from "node:assert"
import { withCORS } from "../src/utils/handler.ts"

function mkReq(method: string, headers: HeadersInit = {}) {
    return new Request("http://ex.com/", { method, headers })
}

test("withCORS: preflight", async () => {
    const handler = withCORS(async () => new Response("ok"))
    const req = mkReq("OPTIONS", {
        origin: "https://site",
        "access-control-request-headers": "x-a, x-b",
        "access-control-request-method": "PUT",
    })
    const res = await handler(req)
    assert.equal(res.status, 204)
    assert.equal(res.headers.get("access-control-allow-origin"), "https://site")
    assert.equal(res.headers.get("access-control-allow-credentials"), "true")
    assert.equal(res.headers.get("access-control-allow-headers"), "x-a, x-b")
    assert.equal(res.headers.get("access-control-allow-methods"), "PUT")
})

test("withCORS: actual request", async () => {
    const handler = withCORS(async () => new Response("ok", { headers: { "x-foo": "bar" } }))
    const req = mkReq("GET", { origin: "null" })
    const res = await handler(req)
    assert.equal(res.status, 200)
    assert.equal(await res.text(), "ok")
    assert.equal(res.headers.get("access-control-allow-origin"), "*")
    assert.equal(res.headers.get("access-control-allow-credentials"), "true")
    assert.equal(res.headers.get("access-control-expose-headers"), "*")
})
