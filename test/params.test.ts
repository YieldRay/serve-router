import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import ServeRouter from "../src/index.ts"

test(async function ctx_params(t) {
    const app = ServeRouter()
    app.get("/hello/:name", (req, ctx) => new Response(ctx.params.name))

    await t.test(async function ctx_params_1() {
        const res = await app.fetch(new Request("http://example.net/hello/ray"))
        const txt = await res.text()
        assert.equal(res.status, 200)
        assert.equal(txt, "ray")
    })

    await t.test(async function ctx_params_2() {
        const res = await app.fetch(new Request("http://example.net/hello/ray/"))
        assert.equal(res.status, 404)
    })

    await t.test(async function ctx_params_3() {
        const res = await app.fetch(new Request("http://example.net/hello/ray/404"))
        const txt = await res.text()
        assert.equal(res.status, 404)
        assert.equal(txt, "Cannot GET /hello/ray/404")
    })
})
