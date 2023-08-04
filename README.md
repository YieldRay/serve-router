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
import App from "https://esm.sh/serve-router@latest"
const { serve } = Deno

// use Node.js >= 16
import App from "serve-router"
import { serve } from "serve-router/node"

// start application
const app = App()

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
// only the last Response object you returns send to the client
// the third parameter is the last Response object returned by previous handler (if given)
// keep in mind that you should check it to determinate if a Response is already given
// otherwise you may have your correct Response overwritten!
app.all("/(.*)", (_req, _ctx, res) => {
    if (!res) return new Response("Oops! nothing here!", { status: 404 })
})

serve(app.export)
```

# advanced

`serve-router` does not support `next()` function like express,  
however you can use two additional handlers to emulate it, like this

```ts
import App from "serve-router"
import { attachStatic } from "serve-router/utils"

const app = App()

app.all("/(.*)", (req: Request, ctx: any) => {
    ctx.beginTime = Date.now()
    console.log("[prehandle]  ", req.method, req.url)
})

// `attachStatic` can only be used in deno
attachStatic(app, "/", "public")

app.all("/(.*)", (req, ctx: any, res: Response | null) => {
    const endTime = Date.now()
    const { beginTime } = ctx
    console.log("[posthandle] ", `Returned ${res!.status} in ${endTime - beginTime}ms`)
})
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
