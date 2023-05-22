// deno-lint-ignore-file
import { match, type MatchFunction, type MatchResult } from "./path-to-regexp/index.ts";

interface Handler<P extends object = object> {
    (request: Request, matches: MatchResult<P>): Response | void | Promise<Response | void>;
}

export default function () {
    const pathToMatcher = new Map<string, MatchFunction>();

    /**
     * helper function, given a path, return the only corresponding matcher function
     */
    const getMatcher = (path: string) =>
        pathToMatcher.has(path) ? pathToMatcher.get(path)! : pathToMatcher.set(path, match(path)).get(path)!;

    /**
     * this is actually a path to handlers map
     */
    const mapper = {
        GET: new Map<MatchFunction, Handler[]>(),
        POST: new Map<MatchFunction, Handler[]>(),
    };
    /**
     * map for handler any request method, lowerest priority
     */
    const mapperAll = new Map<MatchFunction, Handler[]>();

    /**
     * helper function, if array is not exist, create one
     */
    function addMatcherHandlersToMap<P extends object = object>(
        map: Map<MatchFunction, Handler[]>,
        path: string,
        ...handlers: Handler<P>[]
    ) {
        // the key is the matcher
        const matcher = getMatcher(path);

        // add the value to array
        if (!map.has(matcher)) {
            map.set(matcher, [...(handlers as Handler[])]);
        } else {
            map.get(matcher)!.push(...(handlers as Handler[]));
        }
    }

    function addMappedHandler<P extends object = object>(method: string, path: string, ...handlers: Handler<P>[]) {
        const methodString = method.toUpperCase();

        // add http METHOD to mapper
        if (!Reflect.has(mapper, methodString)) Reflect.set(mapper, methodString, new Map());

        // match function to handlers map
        const map: Map<MatchFunction, Handler[]> = Reflect.get(mapper, methodString);

        // add to map
        addMatcherHandlersToMap(map, path, ...handlers);
    }

    async function serveHandler(request: Request) {
        const url = new URL(request.url);
        const path = url.pathname;

        async function findResponse(map?: Map<MatchFunction, Handler[]>) {
            if (!map) return;

            for (const matcher of map.keys()) {
                const matches = matcher(path);
                if (!matches) continue;

                const handlers = map.get(matcher);
                if (!handlers) continue;

                for (const handler of handlers) {
                    // handler can be sync or async
                    const res = (await handler(request, matches)) as Response | void;
                    if (res instanceof Response) {
                        return res;
                    } else {
                        // if not return a Response, find the next one
                        continue;
                    }
                }
            }
        }

        const res1 = await findResponse(Reflect.get(mapper, request.method));
        if (res1 instanceof Response) return res1;

        const res2 = await findResponse(mapperAll);
        if (res2 instanceof Response) return res2;

        return new Response(`Cannot ${request.method} ${url.pathname}`, {
            status: 404,
        });
    }

    function createInstance(prefix = "") {
        return {
            get: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMappedHandler("get", prefix + path, ...handlers);
                return this;
            },
            head: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMappedHandler("head", prefix + path, ...handlers);
                return this;
            },
            post: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMappedHandler("post", prefix + path, ...handlers);
                return this;
            },
            put: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMappedHandler("put", prefix + path, ...handlers);
                return this;
            },
            delete: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMappedHandler("delete", prefix + path, ...handlers);
                return this;
            },
            all: function <P extends object = object>(path: string, ...handlers: Handler<P>[]): typeof this {
                addMatcherHandlersToMap(mapperAll, prefix + path, ...handlers);
                return this;
            },
            route: (path: string) => createInstance(path),
            useMethod: function (method: string) {
                return <P extends object = object>(path: string, ...handlers: Handler<P>[]) => {
                    addMatcherHandlersToMap(mapperAll, prefix + path, ...handlers);
                    return this;
                };
            },
        };
    }

    return { ...createInstance(), export: serveHandler };
}
