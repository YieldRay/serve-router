import { match, type Params } from "./utils/match.ts"

export const METHOD_ALL = Symbol("METHOD_ALL")
export const METHOD_USE = Symbol("METHOD_USE")

/**
 * This Error class allow you to distinct if error is thrown by serve-router.
 */
export class ServeRouterError extends Error {
    override name = "ServeRouterError"
}

type MaybePromise<T> = T | Promise<T>
type TContext = Exclude<object, "params" | "next">
type BuiltInContext<Path extends string = string> = {
    params: Params<Path>
    next: () => Promise<Response>
}

export type ServeRouterHandler<Context extends TContext = {}, Path extends string = string> = {
    (request: Request, context: BuiltInContext<Path> & Context): MaybePromise<Response>
}

export interface ServeRouterOptions<Context extends TContext = {}> {
    /**
     * Callback function when a registered handler throws, this callback capture the error variable,
     * the handler itself, and parameters the handler consumes.
     *
     * This callback function may returnf Response and it will be sent to the client.
     * Please note that onError can be async, but make sure it DOES NOT throws.
     *
     * @param error the variable thrown by the handler.
     * @param handler the throwing handler that cause the error, this should ONLY for debug purpose.
     * @param args the arguments passed to the handler.
     */
    onError?(
        error: unknown,
        handler: ServeRouterHandler,
        args: Parameters<ServeRouterHandler>
    ): ReturnType<ServeRouterHandler> | MaybePromise<void>
    /**
     * @default {}
     */
    context?: Context | ((request: Request) => MaybePromise<Context>)
}

/**
 * @example
 * ```
 * const app = ServeRouter()
 * app.get("/(.*)", req => new Response("hello, world!"))
 * Deno.serve(app.fetch)
 * ```
 */
function ServeRouter<GlobalContext extends TContext = {}>(
    options?: ServeRouterOptions<GlobalContext>
) {
    // prevent call by `new`
    if (new.target)
        throw new ServeRouterError("ServeRouter() is not a constructor, `new` is not required.")

    const onError: NonNullable<ServeRouterOptions["onError"]> =
        options?.onError ||
        ((e, handler, args) =>
            console.error(
                e,
                [
                    "\r\n",
                    "-".repeat(50),
                    "Caused by handler:",
                    handler,
                    "-".repeat(50),
                    "Arguments:",
                ].join("\r\n"),
                args,
                "\r\n",
                "-".repeat(50),
                "\r\n"
            ))

    interface Routes {
        [method: string | symbol]:
            | Array<{
                  path: string
                  handlers: ServeRouterHandler<any, any>[]
              }>
            | undefined
    }

    // store routes added by instance methods
    const routes: Routes = {}

    async function serveHandler(request: Request) {
        // the context object, will pass to handler as the second parameter
        const context = (
            options && "context" in options
                ? typeof options.context === "function"
                    ? await options.context(request)
                    : options.context
                : {}
        ) as GlobalContext & BuiltInContext

        if (typeof context !== "object")
            throw new TypeError("context should be an object or return an object")

        const pendingRoutes = routes[METHOD_USE] || []
        if (request.method in routes) pendingRoutes.push(...routes[request.method]!)
        if (METHOD_ALL in routes) pendingRoutes.push(...routes[METHOD_ALL]!)

        let i = -1
        const next: () => Promise<Response> = async () => {
            i++ // current route index
            if (i >= pendingRoutes.length) {
                return new Response(`Cannot ${request.method} ${new URL(request.url).pathname}`, {
                    status: 404,
                })
            }

            const { path } = pendingRoutes[i]
            const matches = match(path, request.url)
            if (!matches) {
                // try next route
                return next()
            }
            // assign matches to context object
            Reflect.set(context, "params", matches)

            const { handlers } = pendingRoutes[i]
            for (const handler of handlers) {
                try {
                    const response = await handler(request, context)
                    if (response instanceof Response) {
                        return response
                    }
                } catch (e) {
                    const response = await onError(e, handler, [request, context])
                    return response instanceof Response
                        ? response
                        : new Response("Internal Server Error", { status: 500 })
                }
            }

            // no return in current route
            return next()
        }

        Reflect.set(context, "next", next)
        return next()
    }

    function createInstance(prefix = "") {
        const instance = {
            get: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["GET"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            head: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["HEAD"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            post: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["POST"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            put: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["PUT"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            delete: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["DELETE"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            options: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["OPTIONS"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            patch: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes["PATCH"] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            use: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes[METHOD_USE] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            all: function <
                Context extends GlobalContext = GlobalContext,
                Path extends string = string
            >(path: Path, ...handlers: ServeRouterHandler<Context, Path>[]) {
                ;(routes[METHOD_ALL] ||= []).push({ path: prefix + path, handlers })
                return this
            },
            route: (path: string) => createInstance(path),
        }
        return instance
    }

    // export it so we can use it from other library
    const $export: Readonly<Routes> = routes

    return { ...createInstance(), export: $export, fetch: serveHandler }
}

export { ServeRouter, ServeRouter as default }
