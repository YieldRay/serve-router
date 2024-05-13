import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import ServeRouter from "../src/index.ts"

test(async function on_error(t) {
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

    await t.test(async function on_error_1() {
        const res = await app.fetch(new Request("http://example.net/error/one"))
        assert.equal(res.status, 500)
        assert.ok((await res.text()).startsWith("Error: /error/one"))
    })

    await t.test(async function on_error_2() {
        const res = await app.fetch(new Request("http://example.net/error/two"))
        assert.equal(res.status, 404)
    })
})
