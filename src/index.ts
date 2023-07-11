import { match, type MatchFunction, type MatchResult } from "./path-to-regexp/index.js"

export interface Handler<P extends object = object> {
    (request: Request, matches: MatchResult<P>): Response | void | Promise<Response | void>
}

class MatcherProvider {
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
}

export default function (options?: Partial<{ onError(e: unknown): ReturnType<Handler> }>) {
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

    const matcherProvider = new MatcherProvider()

    function addRecord<P extends object = object>(method: string, path: string, ...handlers: Handler<P>[]) {
        records.push({
            method,
            path,
            handlers,
            matcher: matcherProvider.get(path),
        })
    }

    async function serveHandler(request: Request) {
        const url = new URL(request.url)

        const matched: MatchResult = {} as MatchResult

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
                    const res = await handler(request, matched)
                    // if not return a Response, find the next one
                    if (res instanceof Response) return res
                    else continue
                } catch (e) {
                    // the handler() may throw error
                    const res = await onError(e)
                    // if not return a Response, stop to find and return 500 to client
                    if (res instanceof Response) return res
                    else return onErrorDefault(e)
                }
            }
        }

        return new Response(`Cannot ${request.method} ${url.pathname}`, {
            status: 404,
        })
    }

    function createInstance(prefix = "") {
        return {
            get: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("GET", prefix + path, ...handlers)
                return this
            },
            head: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("HEAD", prefix + path, ...handlers)
                return this
            },
            post: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("POST", prefix + path, ...handlers)
                return this
            },
            put: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("PUT", prefix + path, ...handlers)
                return this
            },
            delete: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("DELETE", prefix + path, ...handlers)
                return this
            },
            options: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("OPTIONS", prefix + path, ...handlers)
                return this
            },
            patch: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("PATCH", prefix + path, ...handlers)
                return this
            },
            all: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addRecord("*", prefix + path, ...handlers)
                return this
            },
            route: (path: string) => createInstance(path),
        }
    }

    return { ...createInstance(), export: serveHandler }
}
