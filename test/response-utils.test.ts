import { test } from "node:test"
import * as assert from "node:assert"
import { mergeHeaders, mergeResponseInit, createResponse, transformResponse } from "../src/utils/response.ts"

test("mergeHeaders", () => {
    const h = mergeHeaders({ a: "1", b: "1" }, { b: "2", c: "3" })
    assert.equal(h.get("a"), "1")
    assert.equal(h.get("b"), "2")
    assert.equal(h.get("c"), "3")
})

test("mergeResponseInit", () => {
    const init = mergeResponseInit({ status: 201, headers: { a: "1" } }, { status: 202, headers: { a: "x", b: "2" } })
    const h = new Headers(init.headers)
    assert.equal(init.status, 201)
    assert.equal(h.get("a"), "x")
    assert.equal(h.get("b"), "2")
})

test("createResponse + transformResponse", () => {
    const MyResponse = createResponse({ headers: { a: "1" }, status: 200 })
    const r1 = new MyResponse("ok", { headers: { b: "2" } })
    // status falls back to preInit when not set in init
    assert.equal(r1.status, 200)
    assert.equal(r1.headers.get("a"), "1")
    assert.equal(r1.headers.get("b"), "2")

    const r2 = MyResponse.redirect("http://ex.com/somewhere", 302)
    // mergeResponseInit keeps preInit.status when src has a status but function prefers dest?.status ?? src?.status
    // so status remains 200
    assert.equal(r2.status, 200)
    assert.ok(r2.headers.get("location"))

    const t = transformResponse(r1 as unknown as Response, { headers: { c: "3" }, status: 204 })
    // mergeResponseInit keeps original response status when set
    assert.equal(t.status, 200)
    assert.equal(t.headers.get("a"), "1")
    assert.equal(t.headers.get("b"), "2")
    assert.equal(t.headers.get("c"), "3")
})
