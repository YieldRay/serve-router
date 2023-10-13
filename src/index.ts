import { match, type MatchFunction, type MatchResult } from "./path-to-regexp/index.js"

/**
 * This Error class allow you to distinct if error is thrown by serve-router
 */
export class ServeRouterError extends Error {
    override name = "ServeRouterError"
}

type ServeRouterResponse = Response | void | [Response | void]

export interface ServeRouterHandler<P extends object = object, R extends object = {}> {
    (
        request: Request,
        context: MatchResult<P> & R,
        response: Response | null,
    ): ServeRouterResponse | Promise<ServeRouterResponse>
}

export interface ServeRouterOptions<Ctx extends Exclude<object, keyof MatchResult> = {}> {
    /**
     * Callback function when a registered handler throws, this callback capture the error variable
     * and parameters the handler consumes.
     * This callback function can return any Response and it will be sent to the client.
     */
    onError?(e: unknown, detail: Parameters<ServeRouterHandler>): ReturnType<ServeRouterHandler>
    /**
     * By default serve-router only send the first Response returned by the handler function
     * to the client, continue to execute the rest handler but IGNORE it's Response
     *  (except it returns an array that tell serve-router to force use the it's first value).
     * Enable throwOnDuplicatedResponse and serve-router will throw if you return duplicated
     * Response in the same request
     */
    throwOnDuplicatedResponse?: boolean
    /**
     * @default {}
     */
    context?: Ctx | ((request: Request) => Ctx | Promise<Ctx>)
}

/**
 * @example
 * ```
 * const app = ServeRouter()
 * app.get("/(.*)", req => new Response("hello, world!"))
 * Deno.serve(app.fetch)
 * ```
 */
export default function ServeRouter<S extends Exclude<object, keyof MatchResult> = {}>(
    options?: ServeRouterOptions<S>,
) {
    // prevent call by `new`
    if (new.target) throw new ServeRouterError("ServeRouter() is not a constructor")

    const onErrorDefault = (e: unknown, detail: Parameters<ServeRouterHandler>) => {
        console.error(e, detail)
        return new Response("Internal Server Error", { status: 500 })
    }
    const onError = options?.onError || onErrorDefault

    type Record<P extends object = object> = {
        method: string
        path: string
        matcher: MatchFunction<P>
        handlers: ServeRouterHandler<P, any>[]
    }
    type Records = Record<any>[]

    const records: Records = []

    // given a path string, returns a matcher function
    const matcherProvider = new (class {
        private _map = new Map<string, MatchFunction>()
        get(path: string): MatchFunction {
            if (this._map.has(path)) {
                return this._map.get(path)!
            } else {
                const matcher = match(path)
                this._map.set(path, matcher)
                return matcher
            }
        }
    })()

    function addRecord<P extends object = object, R extends object = {}>(
        method: string,
        path: string,
        ...handlers: ServeRouterHandler<P, R>[]
    ) {
        records.push({
            method,
            path,
            handlers,
            matcher: matcherProvider.get(path),
        })
    }

    async function serveHandler(request: Request) {
        // url for match
        const url = new URL(request.url)

        // the context object, will pass to handler as the second parameter
        const context = (
            options && "context" in options
                ? typeof options.context === "function"
                    ? await options.context(request)
                    : options.context
                : {}
        ) as MatchResult & S

        if (typeof context !== "object")
            throw new TypeError("context should be an object or return an object")

        // can only response once
        let response: Response | null = null

        for (const record of records) {
            // check request method
            // special record method: *
            if (record.method !== "*" && record.method !== request.method) continue

            // check if request pathname is matched
            const { matcher, handlers } = record
            const matches = matcher(url.pathname)
            if (!matches) continue

            // assign matches to context object
            Object.assign(context, matches)
            for (const handler of handlers) {
                try {
                    // handler can be sync or async
                    const handlerResp = await handler(request, context, response)
                    const shouldOverride = Array.isArray(handlerResp)
                    const resp = shouldOverride ? handlerResp[0] : handlerResp

                    // 1
                    if (resp instanceof Response) {
                        if (shouldOverride) {
                            response = resp
                        } else {
                            if (response) {
                                if (options?.throwOnDuplicatedResponse) {
                                    throw new ServeRouterError(
                                        "duplicated Response returned by handler",
                                    )
                                } else {
                                    continue
                                }
                            } else {
                                response = resp
                            }
                        }
                    }
                    // 2
                    else if (resp === undefined) {
                        if (shouldOverride) {
                            response = null
                        } else {
                            continue
                        }
                    }
                    // 3
                    else {
                        throw new ServeRouterError("handlers can only return Response or void")
                    }
                } catch (e) {
                    // the handler() may throw error
                    // when one handler throws, we stop any next handler and returns error response
                    const resp = await onError(e, [request, context, response])
                    // if not return a Response, stop to find and return 500 to client
                    if (resp instanceof Response) return resp
                    else return new Response("Internal Server Error", { status: 500 })
                }
            }
        }

        // the last returned response will be sent
        return (
            response ||
            new Response(`Cannot ${request.method} ${url.pathname}`, {
                status: 404,
            })
        )
    }

    function createInstance(prefix = "") {
        const array = <T>(item: T | T[]) => (Array.isArray(item) ? item : [item])
        return {
            get: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("GET", prefix + p, ...handlers))
                return this
            },
            head: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("HEAD", prefix + p, ...handlers))
                return this
            },
            post: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("POST", prefix + p, ...handlers))
                return this
            },
            put: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("PUT", prefix + p, ...handlers))
                return this
            },
            delete: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("DELETE", prefix + p, ...handlers))
                return this
            },
            options: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("OPTIONS", prefix + p, ...handlers))
                return this
            },
            patch: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("PATCH", prefix + p, ...handlers))
                return this
            },
            all: function <
                P extends object = object,
                R extends Exclude<object, keyof MatchResult> = {},
            >(path: string | string[], ...handlers: ServeRouterHandler<P, R & S>[]): typeof this {
                array(path).forEach((p) => addRecord("*", prefix + p, ...handlers))
                return this
            },
            route: (path: string) => createInstance(path),
        }
    }

    return { ...createInstance(), export: serveHandler, fetch: serveHandler }
}
