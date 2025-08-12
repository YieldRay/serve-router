import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import { match } from "../src/utils/match.ts"

test("match: modifiers and regex", () => {
    // '+' one or more
    const m1 = match("/list/:item+", "http://ex.com/list/a")
    assert.deepEqual(m1, { item: "a" })
    const m1b = match("/list/:item+", "http://ex.com/list/a/b")
    assert.deepEqual(m1b, { item: "a/b" })

    // '*' zero or more (optional)
    const m2a = match("/files/:path*", "http://ex.com/files/")
    assert.equal(m2a, undefined)
    const m2b = match("/files/:path*", "http://ex.com/files/a/b/c.txt")
    assert.deepEqual(m2b, { path: "a/b/c.txt" })

    // '?' optional single segment
    const m3a = match("/opt/:val?", "http://ex.com/opt")
    // Polyfill exposes optional group with undefined value
    assert.deepEqual(m3a, { val: undefined })
    const m3b = match("/opt/:val?", "http://ex.com/opt/x")
    assert.deepEqual(m3b, { val: "x" })

    // regex constraint
    const m4 = match("/num/:id(\\d+)", "http://ex.com/num/123")
    assert.deepEqual(m4, { id: "123" })
    const m4b = match("/num/:id(\\d+)", "http://ex.com/num/abc")
    assert.equal(m4b, undefined)

    // no match
    const m5 = match("/a", "http://ex.com/b")
    assert.equal(m5, undefined)
})
