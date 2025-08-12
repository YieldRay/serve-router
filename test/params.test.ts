import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import ServeRouter from "../src/index.ts"

test(async function ctx_params(t) {
    const app = ServeRouter()
    app.get("/hello/:name", (req, ctx) => new Response(ctx.params.name))

        app.get("/user/:id/profile/:section", (req, ctx) => {
            return new Response(`${ctx.params.id}-${ctx.params.section}`)
        })

        app.get("/number/:num", (req, ctx) => {
            return new Response(String(Number(ctx.params.num) * 2))
        })

        app.get("/optional/:val?", (req, ctx) => {
            return new Response(ctx.params.val ?? "none")
        })

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

        await t.test(async function ctx_params_4() {
            const res = await app.fetch(new Request("http://example.net/user/123/profile/settings"))
            const txt = await res.text()
            assert.equal(res.status, 200)
            assert.equal(txt, "123-settings")
        })

        await t.test(async function ctx_params_5() {
            const res = await app.fetch(new Request("http://example.net/user/abc/profile/xyz"))
            const txt = await res.text()
            assert.equal(res.status, 200)
            assert.equal(txt, "abc-xyz")
        })

        await t.test(async function ctx_params_6() {
            const res = await app.fetch(new Request("http://example.net/number/21"))
            const txt = await res.text()
            assert.equal(res.status, 200)
            assert.equal(txt, "42")
        })

        await t.test(async function ctx_params_7() {
            const res = await app.fetch(new Request("http://example.net/optional/value"))
            const txt = await res.text()
            assert.equal(res.status, 200)
            assert.equal(txt, "value")
        })

        await t.test(async function ctx_params_8() {
            const res = await app.fetch(new Request("http://example.net/optional"))
            const txt = await res.text()
            assert.equal(res.status, 200)
            assert.equal(txt, "none")
        })
})
