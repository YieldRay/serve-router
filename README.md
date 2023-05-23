# serve-router

a small express like library that routes for your http server  
build for deno's [`serve()`](https://deno.land/std/http/server.ts) api, which is compatible with some serverless platform  
e.g. `Cloudflare Workers`  
see: <https://deno.com/manual/runtime/http_server_apis>

# usage

```ts
import { serve } from "https://deno.land/std@0.188.0/http/server.ts";
import App from "https://denopkg.com/yieldray/serve-router/src/index.ts";
// Or use npm
import App from "serve-router";

const app = App();

app.get("/", () => new Response("Hello, world!"));
app.get("/headers", (req: Request) => Response.json(Object.fromEntries(req.headers.entries())));

app.get<{ name: string }>("/user/:name", (_, { params }) => {
    return new Response(`Hello, ${params.name}`);
});

app.post("/post", async (req) => {
    const json = await req.json();
    return Response.json(json);
});

app.route("/api")
    // for /api
    .get("", () => new Response("api"))
    // for /api/one
    .get("/one", () => new Response("one"))
    // for /api/two
    .get("/two", () => new Response("two"));

serve(app.export);

// for those who use node.js, import this simple serve() polyfill
import { serve } from "serve-router/node";
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
