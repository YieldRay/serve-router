import { match, type MatchFunction, type MatchResult } from "./path-to-regexp/index.js"

interface Handler<P extends object = object> {
    (request: Request, matches: MatchResult<P>): Response | void | Promise<Response | void>
}

export default function (options?: Partial<{ onError(e: unknown): ReturnType<Handler> }>) {
    const onErrorDefault = (e: unknown) => {
        console.error(e)
        return new Response("Internal Server Error", {
            status: 500,
        })
    }
    const onError = options?.onError || onErrorDefault

    const pathToMatcher = new Map<string, MatchFunction>()

    /**
     * helper function, given a path, return the only corresponding matcher function
     */
    const getMatcher = (path: string) =>
        pathToMatcher.has(path) ? pathToMatcher.get(path)! : pathToMatcher.set(path, match(path)).get(path)!

    /**
     * this is actually a path to handlers map
     */
    const mapperMethod = {
        GET: new Map<MatchFunction, Handler[]>(),
        POST: new Map<MatchFunction, Handler[]>(),
    }
    /**
     * map for handler app.use(), highest priority
     */
    const mapUse = new Map<MatchFunction, Handler[]>()

    /**
     * map is just a  `Map<MatchFunction, Handler[]>`
     * call `getMatcher()` to get the key
     */
    function addHandlerToMap<P extends object = object>(
        map: Map<MatchFunction, Handler[]>,
        path: string,
        ...handlers: Handler<P>[]
    ) {
        // the key is the matcher
        const matcher = getMatcher(path)

        // add the value to array
        if (!map.has(matcher)) {
            map.set(matcher, [...(handlers as Handler[])])
        } else {
            map.get(matcher)!.push(...(handlers as Handler[]))
        }
    }

    /**
     * mapper is a object that contains map
     */
    function addHandlerToMapper<P extends object = object>(
        mapper: Record<string, Map<MatchFunction, Handler[]>>,
        method: string,
        path: string,
        ...handlers: Handler<P>[]
    ) {
        const methodString = method.toUpperCase()

        // add http METHOD to mapper
        if (!Reflect.has(mapperMethod, methodString)) Reflect.set(mapper, methodString, new Map())

        // match function to handlers map
        const map: Map<MatchFunction, Handler[]> = Reflect.get(mapper, methodString)

        // add to map
        addHandlerToMap(map, path, ...handlers)
    }

    async function serveHandler(request: Request) {
        const url = new URL(request.url)
        const path = url.pathname
        const matched: MatchResult = {} as MatchResult

        async function findResponse(map?: Map<MatchFunction, Handler[]>) {
            if (!map) return

            for (const matcher of map.keys()) {
                const matches = matcher(path)
                if (!matches) continue

                // each handler may add some properties to that object
                Object.assign(matched, matches)

                const handlers = map.get(matcher)
                if (!handlers) continue

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
        }

        const res = await (async () => {
            // highest priority for use()
            const resUse = await findResponse(mapUse)
            if (resUse instanceof Response) return resUse

            const resMethod = await findResponse(Reflect.get(mapperMethod, request.method))
            if (resMethod instanceof Response) return resMethod

            // lowest priority for all()
            const resMethodAll = await findResponse(Reflect.get(mapperMethod, "*"))
            if (resMethodAll instanceof Response) return resMethodAll
        })()

        if (res) return res
        return new Response(`Cannot ${request.method} ${url.pathname}`, {
            status: 404,
        })
    }

    function createInstance(prefix = "") {
        return {
            get: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "get", prefix + path, ...handlers)
                return this
            },
            head: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "head", prefix + path, ...handlers)
                return this
            },
            post: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "post", prefix + path, ...handlers)
                return this
            },
            put: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "put", prefix + path, ...handlers)
                return this
            },
            delete: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "delete", prefix + path, ...handlers)
                return this
            },
            all: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMapper(mapperMethod, "*", prefix + path, ...handlers)
                return this
            },
            use: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addHandlerToMap(mapUse, path, ...handlers)
                return this
            },
            route: (path: string) => createInstance(path),
            useMethod: function (method: string) {
                return <P extends object = object>(path: string, ...handlers: Handler<P>[]) => {
                    addHandlerToMapper(mapperMethod, method, prefix + path, ...handlers)
                    return this
                }
            },
        }
    }

    return { ...createInstance(), export: serveHandler }
}
