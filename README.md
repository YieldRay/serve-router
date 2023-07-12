# serve-router

a small express like library that routes for your http server  
build for deno's [`serve()`](https://deno.land/std/http/server.ts) api, which is compatible with some serverless platform  
e.g. `Cloudflare Workers`  
see: <https://deno.com/manual/runtime/http_server_apis>

# usage

we use the latest version of [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) to match, which is different from what express depends  
for example, you can use `/**` to match any path in express, but should use `/(.*)` here  
you may want to test the match syntax via <https://forbeslindesay.github.io/express-route-tester/>

```ts
// use Deno
import { serve } from "https://deno.land/std@0.191.0/http/server.ts"
import App from "https://esm.sh/serve-router@latest"

// use Node.js >= 16
import { serve } from "serve-router/node"
import App from "serve-router"

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

// `attachStatic` can only be use in deno
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
