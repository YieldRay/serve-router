// @ts-nocheck
import { assertEquals } from "https://deno.land/std/testing/asserts.ts"
import ServeRouter from "../src/index.ts"

Deno.test(async function handler_return(t) {
    const app = ServeRouter()
    app.get("/one", () => new Response("one"))
    app.get("/one", () => new Response("__one__"))

    await t.step(async function handler_return_1() {
        const res = await app.fetch(new Request("http://example.net/one"))
        assertEquals(res.status, 200)
        assertEquals(await res.text(), "one")
    })

    app.get("/two", () => new Response("two"))
    app.get("/two", () => [new Response("__two__")])

    await t.step(async function handler_return_2() {
        const res = await app.fetch(new Request("http://example.net/two"))
        assertEquals(res.status, 200)
        assertEquals(await res.text(), "__two__")
    })
})
