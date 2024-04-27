import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import ServeRouter from "../src/index.ts"

test(async function handler_return(t) {
    const app = ServeRouter()
    app.get("/one", () => new Response("one"))
    app.get("/one", () => new Response("__one__"))

    await t.test(async function handler_return_1() {
        const res = await app.fetch(new Request("http://example.net/one"))
        assert.equal(res.status, 200)
        assert.equal(await res.text(), "one")
    })

    app.get("/two", () => new Response("two"))
    app.get("/two", () => [new Response("__two__")])

    await t.test(async function handler_return_2() {
        const res = await app.fetch(new Request("http://example.net/two"))
        assert.equal(res.status, 200)
        assert.equal(await res.text(), "__two__")
    })
})
