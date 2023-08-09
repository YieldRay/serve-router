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

// start application
const app = ServeRouter()

app.get("/", (_req) => new Response("Hello, world!"))

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
// it throws if you return a Response for the same path twice time
// the third parameter is the Response object returned by previous handlers
// it is null if no Response is returned
app.all("/(.*)", (_req, _ctx, res) => {
    if (!res) return new Response("Oops! No Response for you!", { status: 404 })
})

// you can return an array with it's first element is a Response
// to force override previous Response
app.get("/override", () => {
    return [new Response("force override")]
})

// revoke previous Response
app.get("/404", () => {
    return [undefined]
})

serve(app.export)
```

# advanced

`serve-router` does not support `next()` function like express,  
however you can add two additional handlers to emulate it, like this

```ts
// this example use Deno
import App from "https://esm.sh/serve-router@latest"
import { serveDir } from "https://deno.land/std/http/file_server.ts"

const app = App()

app.all("/(.*)", (req: Request, ctx: Record<keyof any, any>) => {
    ctx.beginTime = Date.now()
    console.log("[prehandle]  ", req.method, req.url)
})

app.all("/static/(.*)", (req: Request) => {
    return serveDir(req, {
        urlRoot: "static",
        fsRoot: "public",
    })
})

app.all("/(.*)", (_req: Request, ctx: Record<keyof any, any>, res: Response | null) => {
    const endTime = Date.now()
    const { beginTime } = ctx
    console.log(
        "[posthandle] ",
        `Returned ${res ? res.status : "nothing"} in ${endTime - beginTime}ms`
    )
})

Deno.serve(app.export)
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
