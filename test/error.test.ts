// @ts-nocheck
import { assertEquals, assertStringIncludes } from "https://deno.land/std/testing/asserts.ts"
import ServeRouter from "../src/index.ts"

Deno.test(async function on_error(t) {
    const app = ServeRouter({
        onError(e: Error) {
            return new Response(e.toString(), { status: 500 })
        },
    })

    app.route("/error")
        .get("/one", () => {
            throw new Error("/error/one")
        })
        .get("/two", () => {
            return "/error/two"
        })

    await t.step(async function on_error_1() {
        const res = await app.fetch(new Request("http://example.net/error/one"))
        assertEquals(res.status, 500)
        assertStringIncludes(await res.text(), "Error: /error/one")
    })

    await t.step(async function on_error_2() {
        const res = await app.fetch(new Request("http://example.net/error/two"))
        assertEquals(res.status, 500)
        assertStringIncludes(await res.text(), "ServeRouterError:")
    })
})
