//@ts-ignore
import fetch, { Request, Response, Headers } from "undici"
import { Pipedream } from "@pipedream/types"

/**
 * Prepare:   
 * Add a trigger, and select any SOURCES you would like,   
 * for example: _New HTTP / Webhook Requests_  
 * (then, in the _trigger_ pannel)  
 * -----------------------------------------------------------
 * Event Data    = Raw Request  
 * HTTP Response = Return a custom response from your workflow
 * -----------------------------------------------------------
 * (save and continue)  
 * Add a step, and select _Run custom code_  
 * Example Code:  
```js
import fetch, { Request, Response, Headers } from "node-fetch";
import { createServe } from "serve-router/pipedream";
const serve = createServe(defineComponent);

export default serve((req) => {
    const u = new URL(req.url);
    u.host = "example.net";
    return fetch(u, new Request(req));
});
```
*/

export function createServe(defineComponent: <T>(options: object) => T) {
    return function serve(handler: (request: Request) => Response | Promise<Response>) {
        return defineComponent({
            async run({ steps, $ }: RunOptions) {
                try {
                    const response = await pipedreamToRequest(steps, handler)
                    await responseToPipedream($, response)
                } catch (e) {
                    await $.respond({
                        status: 500,
                        body: `Internal Server Error\n${e}`,
                    })
                }
            },
        })
    }
}

async function pipedreamToRequest(
    steps: RunOptions["steps"],
    handler: (request: Request) => Response | Promise<Response>
) {
    const event = steps.trigger.event
    const url = new URL(event.url)
    const headers: Record<string, string> = { "x-real-ip": event.client_ip }
    for (let i = 0; i < event.headers.length; i += 2) {
        const k = event.headers[i]
        if (k.toLowerCase() === "host") continue
        const v = event.headers[i + 1]
        headers[k] = v
    }
    const method = event.method
    const body = method === "GET" || method === "HEAD" ? undefined : event.body
    const request = new Request(url, { method, headers, body })
    return await handler(request)
}

async function responseToPipedream($: RunOptions["$"], response: Response) {
    const headers = new Headers(response.headers)
    headers.delete("connection")
    headers.delete("content-encoding")
    // pipedream use node.js14.x, which do not implement the `Readable.fromWeb()` function (node.js>=v17.0.0)
    // so we collect Response.body into a Buffer rather than Readable
    const body = Boolean(response.body) ? Buffer.from(await response.arrayBuffer()) : ""
    return await $.respond({
        status: response.status,
        headers: Object.fromEntries(headers),
        body,
    })
}

type Context = {
    JIT: boolean
    run: { runs: number }
    deadline: number
    id: string
    ts: Date
    pipeline_id: null
    workflow_id: string
    deployment_id: string
    source_type: string
    verified: boolean
    hops: null
    test: boolean
    replay: boolean
    owner_id: string
    platform_version: string
    workflow_name: string
    resume: null
    trace_id: string
}

type Event = {
    method: string
    path: string
    query: Record<string, string>
    client_ip: string
    url: string
    headers: string[]
    body?: string
}

/**
 * @see https://pipedream.com/docs/components/api/#component-structure
 */
interface RunOptions {
    steps: {
        trigger: {
            context: Omit<Context, "JIT" | "run" | "deadline">
            event: Event
        }
    }
    $: Pipedream & {
        respond(options: {
            immediate?: boolean
            status?: number
            headers?: Record<string, string>
            body?: string | object | Buffer | ReadableStream
            bodyRaw?: any
        }): any
        context: Context
        event: Event
    }
}
