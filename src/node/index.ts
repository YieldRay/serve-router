import http from "node:http"
import { Readable } from "node:stream"
import type { ReadableStream } from "node:stream/web"
import type { AddressInfo } from "node:net"

// fix type issue
declare global {
    interface RequestInit {
        duplex?: string
    }
}

export interface ServeHandlerInfo {
    remoteAddr: {
        transport: "tcp" | "udp"
        hostname: string
        port: number
    }
}

export type ServeHandler = (
    request: Request,
    info: ServeHandlerInfo
) => Response | Promise<Response>

export interface ServeOptions {
    /**
     * @default {8000}
     */
    port?: number
    hostname?: string
    signal?: AbortSignal
    /**
     * @warn Not Supported
     */
    reusePort?: boolean
    onError?: (error: unknown) => Response | Promise<Response>
    onListen?: (params: { hostname: string; port: number }) => void
}

export interface ServeInit {
    handler: ServeHandler
}

/**
 * Transform node.js http.IncomingMessage to web Request
 */
export function incoming2request(req: http.IncomingMessage): Request {
    const method = req.method ?? "GET"
    const body = ["HEAD", "GET"].includes(method.toUpperCase())
        ? undefined
        : (Readable.toWeb(req) as globalThis.ReadableStream)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v))
        } else {
            headers.append(key, value ?? "")
        }
    }

    const path = req.url ?? "/"
    const host: string = req.headers.host ?? (req.socket.address() as AddressInfo).address

    // const protocol = (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
    return new Request(new URL(path, `http://${host}`), {
        method,
        headers,
        body,
        duplex: "half",
    })
}

/**
 * Forward web Response for http.ServerResponse
 */
export function response4server(res: http.ServerResponse, resp: Response) {
    res.statusCode = resp.status
    resp.headers.forEach((value, key) => {
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

/**
 * Deno To Node (d2n)
 *
 * Convert deno's serve handler to nodejs's http request handler.
 *
 * @example
 * const app = ServeRouter()
 * app.get("/(.*)", () => { })
 * http.createServer(d2n(app.fetch)).listen(8080)
 */
export function d2n(handler: ServeHandler) {
    const requestHandler: http.RequestListener<
        typeof http.IncomingMessage,
        typeof http.ServerResponse
    > = async (req, res) => {
        const webReq = incoming2request(req)
        const webRes = await handler(webReq, {
            remoteAddr: {
                transport: "tcp",
                hostname: req.socket.remoteAddress!,
                port: req.socket.remotePort!,
            },
        })
        response4server(res, webRes)
    }
    return requestHandler
}

/**
 * Implement Deno's `Deno.serve()` function for node.js
 * @warn Returns node.js `http.Server`, rather than `Deno.Server`
 */
export function serve(handler: ServeHandler): http.Server
export function serve(options: ServeOptions, handler: ServeHandler): http.Server
export function serve(options: ServeInit & ServeOptions): http.Server
export function serve(
    options: ServeHandler | ServeOptions | (ServeInit & ServeOptions),
    handler?: ServeHandler
) {
    const serveHandler: ServeHandler | undefined =
        handler || typeof options === "function"
            ? (options as ServeHandler)
            : "handler" in options
            ? options.handler
            : undefined

    if (!serveHandler) throw new TypeError("A handler function must be provided.")

    const serveOptions: ServeOptions = typeof options !== "function" ? options : {}

    const port = serveOptions.port ?? 8000

    const server = http
        .createServer(async (req, res) => {
            try {
                const webReq = incoming2request(req)
                const webRes = await serveHandler(webReq, {
                    remoteAddr: {
                        transport: "tcp",
                        hostname: req.socket.remoteAddress!,
                        port: req.socket.remotePort!,
                    },
                })
                response4server(res, webRes)
            } catch (e) {
                const onErrorDefault = (e: unknown) => {
                    console.error(e)
                    return new Response("Internal Server Error", { status: 500 })
                }
                const onError = serveOptions.onError?.bind(serveOptions.onError) || onErrorDefault
                try {
                    // in case options.onError() throw any error
                    response4server(res, await onError(e))
                } catch {
                    response4server(res, onErrorDefault(e))
                }
            }
        })
        .listen(port, () =>
            (
                serveOptions.onListen ||
                (({ hostname, port }) => {
                    console.log(`Listening on http://${hostname}:${port}`)
                })
            )({ hostname: "localhost", port })
        )

    serveOptions.signal?.addEventListener("abort", () => {
        server.close()
    })

    return server
}
