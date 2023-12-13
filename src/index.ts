import { match } from "./utils/match.ts"

/**
 * This Error class allow you to distinct if error is thrown by serve-router
 */
export class ServeRouterError extends Error {
    override name = "ServeRouterError"
}

type ServeRouterResponse = Response | void | [Response | void]

type TContext = Exclude<object, "params">
type TParams = Exclude<ReturnType<typeof match>, undefined>

export interface ServeRouterHandler<
    Params extends TParams = TParams,
    Context extends TContext = {}
> {
    (request: Request, context: { params: Params } & Context, response: Response | null):
        | ServeRouterResponse
        | Promise<ServeRouterResponse>
}

export interface ServeRouterOptions<Context extends TContext = {}> {
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
    context?: Context | ((request: Request) => Context | Promise<Context>)
}

/**
 * @example
 * ```
 * const app = ServeRouter()
 * app.get("/(.*)", req => new Response("hello, world!"))
 * Deno.serve(app.fetch)
 * ```
 */
export default function ServeRouter<Context extends TContext = {}>(
    options?: ServeRouterOptions<Context>
) {
    // prevent call by `new`
    if (new.target) throw new ServeRouterError("ServeRouter() is not a constructor")

    const onErrorDefault = (e: unknown, detail: Parameters<ServeRouterHandler>) => {
        console.error(e, detail)
        return new Response("Internal Server Error", { status: 500 })
    }
    const onError = options?.onError || onErrorDefault

    type Record = {
        method: string
        path: string
        handlers: ServeRouterHandler<any, any>[]
    }

    // store records added by instance methods
    const records: Record[] = []

    // just a helper function for adding a record
    function addRecord<Params extends TParams, Context extends TContext>(
        method: string,
        path: string,
        ...handlers: ServeRouterHandler<Params, Context>[]
    ) {
        records.push({
            method,
            path,
            handlers,
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
        ) as Context & { params: TParams }

        if (typeof context !== "object")
            throw new TypeError("context should be an object or return an object")

        // can only response once
        let response: Response | null = null

        for (const record of records) {
            // check request method
            // special record method: *
            if (record.method !== "*" && record.method !== request.method) continue

            // check if request pathname is matched
            const { path, handlers } = record
            const matches = match(path, request.url)
            if (!matches) continue

            // assign matches to context object
            Reflect.set(context, "params", matches)
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
                                        "duplicated Response returned by handler"
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
            get: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("GET", prefix + p, ...handlers))
                return this
            },
            head: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("HEAD", prefix + p, ...handlers))
                return this
            },
            post: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("POST", prefix + p, ...handlers))
                return this
            },
            put: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("PUT", prefix + p, ...handlers))
                return this
            },
            delete: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("DELETE", prefix + p, ...handlers))
                return this
            },
            options: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("OPTIONS", prefix + p, ...handlers))
                return this
            },
            patch: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("PATCH", prefix + p, ...handlers))
                return this
            },
            all: function <Params extends TParams = {}, Context extends TContext = {}>(
                path: string | string[],
                ...handlers: ServeRouterHandler<Params, Context>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("*", prefix + p, ...handlers))
                return this
            },
            route: (path: string) => createInstance(path),
        }
    }

    return { ...createInstance(), export: serveHandler, fetch: serveHandler }
}
