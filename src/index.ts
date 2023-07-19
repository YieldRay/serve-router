import { match, type MatchFunction, type MatchResult } from "./path-to-regexp/index.js"

export interface Handler<P extends object = object> {
    (request: Request, matches: MatchResult<P>, response: Response | null):
        | Response
        | void
        | Promise<Response | void>
}

export default function (
    options?: Partial<{
        onError(e: unknown, detail: Parameters<Handler>): ReturnType<Handler>
    }>
) {
    const onErrorDefault = (e: unknown) => {
        console.error(e)
        return new Response("Internal Server Error", { status: 500 })
    }
    const onError = options?.onError || onErrorDefault

    type Record<P extends object = object> = {
        method: string
        path: string
        matcher: MatchFunction<P>
        handlers: Handler<P>[]
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

    function addRecord<P extends object = object>(
        method: string,
        path: string,
        ...handlers: Handler<P>[]
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

        // the matched object, will pass to handler as the second parameter
        const matched: MatchResult = {} as MatchResult

        // can only response once
        let response: Response | null = null

        for (const record of records) {
            // check request method
            // special record method: *
            if (record.method !== "*" && record.method !== request.method) continue

            // check if request pathname is matched
            const { matcher } = record
            const matches = matcher(url.pathname)
            if (!matches) continue

            // each handler may add some properties to that object
            Object.assign(matched, matches)
            const { handlers } = record
            for (const handler of handlers) {
                try {
                    // handler can be sync or async
                    const res = await handler(request, matched, response)

                    if (res instanceof Response) {
                        // replace last response with new one
                        response = res
                    }
                    // if not return a Response, find the next one
                    else continue
                } catch (e) {
                    // the handler() may throw error
                    // when one handler throws, we stop any next handler and returns error response
                    const res = await onError(e, [request, matched, response])
                    // if not return a Response, stop to find and return 500 to client
                    if (res instanceof Response) return res
                    else return onErrorDefault(e)
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
            get: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("GET", prefix + p, ...handlers))
                return this
            },
            head: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("HEAD", prefix + p, ...handlers))
                return this
            },
            post: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("POST", prefix + p, ...handlers))
                return this
            },
            put: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("PUT", prefix + p, ...handlers))
                return this
            },
            delete: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("DELETE", prefix + p, ...handlers))
                return this
            },
            options: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("OPTIONS", prefix + p, ...handlers))
                return this
            },
            patch: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("PATCH", prefix + p, ...handlers))
                return this
            },
            all: function <P extends object = object>(
                path: string | string[],
                ...handlers: Handler<P>[]
            ): typeof this {
                array(path).forEach((p) => addRecord("*", prefix + p, ...handlers))
                return this
            },
            route: (path: string) => createInstance(path),
        }
    }

    return { ...createInstance(), export: serveHandler }
}
