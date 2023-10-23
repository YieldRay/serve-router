# serve-router

a small express like library that routes for your http server  
build for deno's [`Deno.serve()`](https://deno.land/api?s=Deno.serve) api, which is compatible with some serverless platform  
e.g. [`Cloudflare Workers`](https://workers.dev/) [`val.town Web API`](https://www.val.town/v/yieldray.serve_router)  
see: <https://deno.com/manual/runtime/http_server_apis>

# usage

we use the latest version of [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) for matching, which is different from the version express depends  
for example, you can use `/**` to match any path in express, but should use `/(.*)` here  
you may want to test the match syntax via <https://route-tester.surge.sh/>

```ts
// use Deno
import ServeRouter from "https://esm.sh/serve-router@latest"
const { serve } = Deno

// use Node.js >= 16
import ServeRouter from "serve-router"
import { serve } from "serve-router/node"

// or use this to auto detect deno or node
import { serve } from "serve-router/shim"

// init application
const app = ServeRouter({ context: { hello: "world" } })

app.all("/(.*)", (_req, ctx) => {
    console.assert(ctx.hello, "world")
})

app.get("/", () => new Response("Hello, world!"))

app.get("/headers", (req: Request) => Response.json(Object.fromEntries(req.headers.entries())))

app.get<{ name: string }>("/user/:name", (_req, { params }) => {
    return new Response(`Hello, ${params.name}`)
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
app.all("/(.*)", (_req, _ctx, res) => {
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

// if you only want to run it in node.js, you can 
// convert it into a node.js http middleware like this
import { d2n } from "serve-router/node"
http.createServer(d2n(app.fetch)).listen(8080)
```

# advanced

`serve-router` does not support `next()` function like express,  
however you can add two additional handlers to emulate it, like this

```ts
// this example use Deno
import ServeRouter from "https://esm.sh/serve-router@latest"
import { serveDir } from "https://deno.land/std/http/file_server.ts"

const app = ServeRouter()
// OR: const app = ServeRouter<{ beginTime: number }>()

app.all<{}, { beginTime: number }>("/(.*)", (req: Request, ctx) => {
    ctx.beginTime = Date.now()
    console.log("[prehandle]  ", req.method, req.url)
})

app.all("/static/(.*)", (req) =>
    serveDir(req, {
        urlRoot: "static",
        fsRoot: "public",
    })
)

app.all<{}, { beginTime: number }>("/(.*)", (_req: Request, ctx, res: Response | null) => {
    const endTime = Date.now()
    const { beginTime } = ctx
    console.log(
        "[posthandle] ",
        `Returned ${res ? res.status : "nothing"} in ${endTime - beginTime}ms`
    )
})

Deno.serve(app.fetch)
```

# build

```sh
git clone https://github.com/YieldRay/serve-router.git
cd serve-router

pnpm install
mkdir -p src/path-to-regexp
curl -fSskL https://github.com/pillarjs/path-to-regexp/raw/master/src/index.ts -o src/path-to-regexp/index.ts

pnpm run build
```
