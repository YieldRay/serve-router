// @ts-nocheck
import { assertEquals } from "https://deno.land/std/testing/asserts.ts"
import ServeRouter from "../dist/index.js"

Deno.test(async function ctx_params(t) {
    const app = ServeRouter()
    app.get<{ name: string }>("/hello/:name", (req, ctx) => new Response(ctx.params.name))

    await t.step(async function ctx_params_1() {
        const res = await app.export(new Request("http://example.net/hello/ray"))
        const txt = await res.text()
        assertEquals(res.status, 200)
        assertEquals(txt, "ray")
    })

    await t.step(async function ctx_params_2() {
        const res = await app.export(new Request("http://example.net/hello/ray/"))
        const txt = await res.text()
        assertEquals(res.status, 200)
        assertEquals(txt, "ray")
    })

    await t.step(async function ctx_params_3() {
        const res = await app.export(new Request("http://example.net/hello/ray/404"))
        const txt = await res.text()
        assertEquals(res.status, 404)
        assertEquals(txt, "Cannot GET /hello/ray/404")
    })
})
