# serve-router

A small express like library that routes for your http server.

Build for deno's [`Deno.serve()`](https://deno.land/api?s=Deno.serve) api, which also compatible with some serverless platform.  
e.g. [`Bun.serve()`](https://bun.sh/docs/api/http#bun-serve) [`Cloudflare Workers`](https://workers.dev/) [`val.town Web API`](https://www.val.town/v/yieldray.serve_router)  
see: <https://deno.com/manual/runtime/http_server_apis>

# Usage

We use the [`URL Pattern API`](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API) for matching.  
It's based on the [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) library, the one that express depends.  
For details, see [the standard](https://urlpattern.spec.whatwg.org/).

For environment that does not support `URLPattern()`, just import [`urlpattern-polyfill`](https://www.npmjs.com/package/urlpattern-polyfill).

Requirement: support Web Standard API: `Request` `Response`.  
For node.js < 18, this means polyfill is required.

```ts
// use Deno
import ServeRouter from "https://esm.sh/serve-router@latest"
const { serve } = Deno // Deno >= 1.15 support URLPattern()

// use Node.js >= 18
import "urlpattern-polyfill" // Node.js does not support URLPattern() currently
import ServeRouter from "serve-router"
import { serve } from "serve-router/node" // polyfill for Deno.serve()

// init application (context is optional)
const app = ServeRouter({ context: { hello: "world" } })

app.all("/*", (_req, ctx) => {
    console.assert(ctx.hello, "world")
})

app.get("/", () => new Response("Hello, world!"))

app.get("/headers", (req: Request) => Response.json(Object.fromEntries(req.headers.entries())))

app.get("/user/:name", (_req, { params }) => {
    // (Auto inferred types)
    // params: { name: string }
    return new Response(`Hello, ${params.name}`)
    // (To disable params infer)
    // app.get("/user/:name" as string, ...)
})

app.post("/post", async (req) => {
    const json = await req.json()
    return Response.json(json)
})

app.route("/api")
    // for /api
    .get("", () => new Response("api"))
    // for /api/one
    .get("/one", () => new Response("one"))
    // for /api/two
    .get("/two", () => new Response("two"))

// Pitfall:
// only the first Response object you returns send to the client
app.all("/*", (_req, _ctx, res) => {
    return new Response("Oops! No Response for you!", { status: 404 })
})

// you can return an array with it's first element is a Response
// to force override previous Response
app.get("/404", () => {
    return [new Response("404", { status: 404 })]
})

// revoke previous Response
app.get("/nothing", () => {
    return [undefined]
})

serve(app.fetch)
```

If you only want to run it in node.js, you can convert it into a node.js http middleware like this:

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
// or
// http.createServer(d2n(app.fetch)).listen(8080)
```

For `Cloudflare Workers` and `Bun`

```js
const app = ServeRouter()
app.get("/", () => new Response("Hello, world!"))
export default {
    fetch: app.fetch,
}
```

# Advanced

`serve-router` does not support `next()` function like express,  
however you can add two additional handlers to emulate it, like this

```ts
// this example use Deno
import ServeRouter from "https://esm.sh/serve-router@latest"
import { serveDir } from "https://deno.land/std/http/file_server.ts"

const app = ServeRouter()
// OR: const app = ServeRouter<{ beginTime: number }>()

app.all<{ beginTime: number }>("/(.*)", (req: Request, ctx) => {
    ctx.beginTime = Date.now()
    console.log("[prehandle]  ", req.method, req.url)
})

app.all("/static/(.*)", (req) =>
    serveDir(req, {
        urlRoot: "static",
        fsRoot: "public",
    })
)

app.all<{ beginTime: number }>("/(.*)", (_req: Request, ctx, res: Response | null) => {
    const endTime = Date.now()
    const { beginTime } = ctx
    console.log(
        "[posthandle] ",
        `Returned ${res ? res.status : "nothing"} in ${endTime - beginTime}ms`
    )
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
