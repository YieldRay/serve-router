// @ts-nocheck
import { assertEquals, assertInstanceOf } from "https://deno.land/std/testing/asserts.ts"
import ServeRouter, { ServeRouterError } from "../dist/index.js"

Deno.test(async function handler_return(t) {
    const app = ServeRouter({
        onError(e, detail) {
            return new Response("Oops!")
        },
    })
    app.get("/one", () => new Response("one"))
    app.get("/one", () => new Response("__one__"))

    await t.step(async function handler_return_1() {
        try {
            const res = await app.export(new Request("http://example.net/one"))
        } catch (e) {
            assertInstanceOf(e, ServeRouterError)
        }
    })

    app.get("/two", () => new Response("two"))
    app.get("/two", () => [new Response("__two__")])

    await t.step(async function handler_return_2() {
        const res = await app.export(new Request("http://example.net/two"))
        const txt = await res.text()
        assertEquals(res.status, 200)
        assertEquals(txt, "__two__")
    })
})
