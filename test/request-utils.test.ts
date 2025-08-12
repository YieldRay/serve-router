import { test } from "node:test"
import * as assert from "node:assert"
import { parseRequestBody, extractAllEntries, extractNestedEntries, buildBasicAuth, parseBasicAuth, buildBearerAuth, parseBearerAuth } from "../src/utils/request.ts"

async function makeReq(body: BodyInit | null, headers: HeadersInit = {}) {
    return new Request("http://ex.com/", { method: "POST", body, headers })
}

test("parseRequestBody: json", async () => {
    const req = await makeReq(JSON.stringify({ a: 1 }), { "content-type": "application/json" })
    const parsed = await parseRequestBody(req)
    assert.deepEqual(parsed, { a: 1 })
})

test("parseRequestBody: urlencoded", async () => {
    const req = await makeReq("a=1&a=2&b=x", { "content-type": "application/x-www-form-urlencoded" })
    const parsed = await parseRequestBody(req)
    assert.deepEqual(parsed, { a: ["1", "2"], b: "x" })
})

test("parseRequestBody: multipart", async () => {
    const fd = new FormData()
    fd.append("a", "1")
    fd.append("a", "2")
    fd.append("b", "x")
    // Let undici set the correct multipart boundary header automatically
    const req = new Request("http://ex.com/", { method: "POST", body: fd })
    const parsed = await parseRequestBody(req)
    assert.deepEqual(parsed, { a: ["1", "2"], b: "x" })
})

test("parseRequestBody: fallback content-type", async () => {
    // Construct a ReadableStream body so undici does not auto-set content-type
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        start(c) {
            c.enqueue(encoder.encode(JSON.stringify({ a: 1 })))
            c.close()
        },
    })
    const req = new Request("http://ex.com/", { method: "POST", body: stream, duplex: "half" })
    const parsed = await parseRequestBody(req, "application/json")
    assert.deepEqual(parsed, { a: 1 })
})

test("parseRequestBody: unsupported", async () => {
    const req = await makeReq("x", { "content-type": "text/plain" })
    await assert.rejects(() => parseRequestBody(req), /Unsupported or unknown content-type/)
})

test("extractAllEntries", () => {
    const e = new URLSearchParams("a=1&a=2&b=x")
    assert.deepEqual(extractAllEntries(e.entries()), { a: ["1", "2"], b: "x" })
})

test("extractNestedEntries", () => {
    const e = new URLSearchParams({ "source[privacy]": "public", "source[language]": "en", "top": "x" })
    assert.deepEqual(extractNestedEntries(e.entries()), { top: "x", source: { privacy: "public", language: "en" } })
})

test("basic auth helpers", () => {
    const header = buildBasicAuth("user", "pa:ss")
    const parsed = parseBasicAuth(header)
    assert.ok(parsed)
    assert.equal(parsed!.username, "user")
    assert.equal(parsed!.password, "pa:ss")

    // invalid
    assert.equal(parseBasicAuth("Basic "), undefined)
})

test("bearer auth helpers", () => {
    const header = buildBearerAuth("token123")
    assert.equal(parseBearerAuth(header), "token123")
    assert.equal(parseBearerAuth("Bearer"), undefined)
})
