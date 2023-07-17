import http from "node:http"
import { Duplex, Readable } from "node:stream"
import type { ReadableStream } from "node:stream/web"

export function incoming2request(req: http.IncomingMessage): Request {
    const method = req.method ?? "GET"
    let body = undefined
    if (!["HEAD", "GET"].includes(method.toUpperCase())) {
        const dp = new Duplex()
        req.pipe(dp)
        body = Readable.toWeb(dp) as globalThis.ReadableStream
    }
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v))
        } else {
            headers.append(key, value ?? "")
        }
    }

    if (!req.url) req.url = "/"
    if (!req.headers.host) throw new Error("the headers 'Host' is unset")

    // const protocal = (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
    return new Request(new URL(req.url, `http://${req.headers.host}`), {
        method,
        headers,
        body,
    })
}

export function response4server(res: http.ServerResponse, resp: Response) {
    res.statusCode = resp.status
    resp.headers.forEach(([key, value]) => {
        if (res.hasHeader(key)) {
            res.setHeader(key, [res.getHeader(key)!, value].map(String).flat())
        } else {
            res.setHeader(key, value)
        }
    })
    if (resp.body) {
        Readable.fromWeb(resp.body as ReadableStream).pipe(res)
    } else {
        res.end()
    }
}

export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: {
        port?: number
        onError?: (error: unknown) => Response | Promise<Response>
        onListen?: (params: { hostname: string; port: number }) => void
    },
) {
    const onErrorDefault = (e: unknown) => {
        console.error(e)
        return new Response("Internal Server Error", { status: 500 })
    }
    const port = options?.port ?? 3000
    http.createServer(async (req, res) => {
        try {
            const webReq = incoming2request(req)
            const webRes = await handler(webReq)
            response4server(res, webRes)
        } catch (e) {
            const onError = options?.onError?.bind(options.onError) || onErrorDefault
            try {
                // in case options.onError() throw any error
                response4server(res, await onError(e))
            } catch {
                response4server(res, onErrorDefault(e))
            }
        }
    }).listen(port, () =>
        (
            options?.onListen ||
            (({ hostname, port }) => {
                console.log(`Listening on http://${hostname}:${port}`)
            })
        )({ hostname: "localhost", port }),
    )
}
