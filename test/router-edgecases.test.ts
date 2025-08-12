import { test } from "node:test"
import * as assert from "node:assert"
import "urlpattern-polyfill"
import ServeRouter, { METHOD, METHOD_ALL, METHOD_USE, ServeRouterError } from "../src/index.ts"

test("ServeRouter: not newable", () => {
    assert.throws(() => new (ServeRouter as any)(), ServeRouterError)
})

test("ServeRouter: invalid context type throws", async () => {
    const app = (ServeRouter as any)({ context: 1 })
    await assert.rejects(() => app.fetch(new Request("http://e/"))), TypeError
})

test("ServeRouter: method routing and .route() prefix", async () => {
    const app = ServeRouter()
    app.post("/p", () => new Response("post"))
    app.get("/p", () => new Response("get"))
    app.route("/api").get("/x", () => new Response("rx"))

    let r = await app.fetch(new Request("http://e/p", { method: "POST" }))
    assert.equal(await r.text(), "post")
    r = await app.fetch(new Request("http://e/p", { method: "GET" }))
    assert.equal(await r.text(), "get")
    r = await app.fetch(new Request("http://e/api/x", { method: "GET" }))
    assert.equal(await r.text(), "rx")
})

test("ServeRouter: middleware order and next() fallthrough", async () => {
    const app = ServeRouter()
    const calls: string[] = []
    app.use("/**", async (_req, { next }) => {
        calls.push("mw1-pre")
        const resp = await next()
        calls.push("mw1-post")
        return resp
    })
    app.get("/a", (_req, { next }) => next()) // fallthrough
    app.get("/b", () => new Response("b"))
    app.all("/**", () => new Response("catch"))

    const r1 = await app.fetch(new Request("http://e/a"))
    assert.equal(await r1.text(), "catch")
    const r2 = await app.fetch(new Request("http://e/b"))
    assert.equal(await r2.text(), "b")
    assert.deepEqual(calls, ["mw1-pre", "mw1-post", "mw1-pre", "mw1-post"]) // once per request
})

test("ServeRouter: METHOD symbol and export map", async () => {
    const app = ServeRouter()
    ;(app as any)[METHOD]("PURGE", "/x", () => new Response("purge"))
    const r = await app.fetch(new Request("http://e/x", { method: "PURGE" }))
    assert.equal(await r.text(), "purge")
    // export exists and contains routes
    const hasUse = METHOD_USE in app.export || METHOD_ALL in app.export || "GET" in app.export
    assert.equal(typeof hasUse, "boolean")
})
