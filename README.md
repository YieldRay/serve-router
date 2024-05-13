# serve-router

A tiny router library that routes for your [web standard HTTP server](https://workers.js.org/).

Build for Deno's [`Deno.serve()`](https://deno.land/api?s=Deno.serve) api, which is also compatible with some serverless platforms.   
e.g. [`Bun.serve()`](https://bun.sh/docs/api/http#bun-serve) [`Cloudflare Workers`](https://workers.dev/) [`val.town Web API`](https://www.val.town/v/yieldray.serve_router)    
see: <https://deno.com/manual/runtime/http_server_apis>    
Node.js is also supported with built-in polyfill.

**features**:

-   Works in any runtime - Node.js, Bun, Deno, Cloudflare Workers
-   Easy to use with a familiar API
-   Integrate with the existing ecosystem
-   Fully typed
-   Zero dependency

> [!NOTE]  
> For those who are building large web application, [Hono](https://hono.dev/) may be preferred.

# Usage

We use the [`URL Pattern API`](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API) for matching.  
It's based on the [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) library, the one that express depends.  
For details, see [the standard](https://urlpattern.spec.whatwg.org/).

For environments that do not support `URLPattern()`, just import [`urlpattern-polyfill`](https://www.npmjs.com/package/urlpattern-polyfill).

Requirement: support Web Standard API: `Request` `Response`.  
For Node.js < 18, this means polyfill is required.

```ts
// use Deno
import ServeRouter from "https://esm.sh/serve-router@latest"
const { serve } = Deno // Deno >= 1.15 support URLPattern()

// use Node.js >= 18 or Bun
import "urlpattern-polyfill" // Node.js and Bun do not support URLPattern() currently
import ServeRouter from "serve-router"
import { serve } from "serve-router/node" // polyfill for Deno.serve(), not required for bun

// init application (context is optional)
const app = ServeRouter()

app.all("/", () => new Response("Hello, world!"))

app.get("/headers", (request: Request) =>
    Response.json(Object.fromEntries(request.headers.entries()))
)

app.get("/user/:name", (_req, { params }) => {
    // (auto-inferred types)
    // params: { name: string }
    return new Response(`Hello, ${params.name}`)
    // (To disable params infer)
    // app.get("/user/:name" as string, ...)
})

app.post("/post", async (req) => {
    const json = await req.json()
    return Response.json(json)
})

app.route("/api") // for /api
    .get("", () => new Response("api")) // for /api/one
    .get("/one", () => new Response("one")) // for /api/two
    .get("/two", () => new Response("two"))

app.use("/**", async (_req, { next }) => {
    const start = Date.now()
    const resp = await next()
    const ms = Date.now() - start

    return new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers.entries()), "X-Response-Time": `${ms}ms` },
    })
    // OR:
    // import { transformResponse } from "serve-router/utils"
    // return transformResponse(resp, { headers: { "X-Response-Time": `${ms}ms` } })
})

// Pitfall:
// if you want to catch all when other route does not match, use app.all()
app.all("/*", (_req) => {
    return new Response("Catch!", { status: 404 })
})
// be aware that code below will override all matched route, which may not be what you want
app.use("/*", async (_req, { next }) => {
    await next() // run other middlewares
    return new Response("Oops!", { status: 404 }) // returns `Oops!` for any request
})

// for Deno or Node.js
serve(app.fetch)
// for Bun
Bun.serve({ fetch: app.fetch })
```

If you only want to run it in Node.js, you can convert it into a Node.js http middleware like this:

```js
import "urlpattern-polyfill"
import { d2n } from "serve-router/node"
const app = ServeRouter()
app.get("/", () => new Response("Hello, world!"))
http.createServer(d2n(app.fetch)).listen(8080)
```

This library supports CommonJS environment.

```js
require("urlpattern-polyfill")
const { d2n, serve } = require("serve-router/node")
const { ServeRouter } = require("serve-router")
const http = require("http")
const app = ServeRouter()
app.get("/", () => new Response("Hello, world!"))

serve({ handler: app.fetch, port: 8080 })
// OR:
// http.createServer(d2n(app.fetch)).listen(8080)
```

For `Cloudflare Workers`, `Bun` and `Deno`

```js
const app = ServeRouter()
app.get("/", () => new Response("Hello, world!"))
export default {
    fetch: app.fetch,
}
```

# Advanced

```ts
// this example use Deno
import ServeRouter from "npm:serve-router"
import { serveDir } from "jsr:@std/http/file-server"
import { setCookie, getCookies, type Cookie } from "jsr:@std/http/cookie"

const app = ServeRouter({
    context: { beginTime: Date.now() },
    onError(err) {
        console.log(err)
    },
})
// OR: const app = ServeRouter<{ beginTime: number }>()

app.all("/static/(.*)", (req) =>
    serveDir(req, {
        urlRoot: "static",
        fsRoot: "public",
    })
)

app.get("/", async (req) => {
    const cookies: Record<string, string> = getCookies(req.headers)
    const visitTimes = Number(cookies.visitTimes) || 0

    const headers = new Headers()
    const cookie: Cookie = { name: "visitTimes", value: String(visitTimes + 1) }
    setCookie(headers, cookie)

    return new Response(`Visit ${visitTimes} ${visitTimes > 0 ? "times" : "time"}!`, { headers })
})

app.use<{ beginTime: number }>("/(.*)", async (req, ctx) => {
    ctx.beginTime = Date.now()
    console.log("[prehandle]  ", req.method, req.url)
    const resp = await ctx.next()
    const endTime = Date.now()
    console.log("[posthandle] ", `Returned ${resp.status} in ${endTime - ctx.beginTime}ms`)
    return resp
})

app.all<{ beginTime: number }>("/(.*)", async (_req, ctx) => {
    return new Response(`Request begins at ${new Date(ctx.beginTime)}`)
})

Deno.serve(app.fetch)
```

# Build

```sh
git clone https://github.com/YieldRay/serve-router.git
cd serve-router
pnpm install
pnpm run build
```
