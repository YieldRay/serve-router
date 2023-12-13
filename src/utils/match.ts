// just for type
import type {} from "urlpattern-polyfill"

/**
 * @example
 * match("/user/:name", "http://example.net/user/ray") // => { name: "ray" }
 */
export function match(pathname: string, url: string) {
    const pattern = new URLPattern({ pathname })
    return pattern.exec(url)?.pathname.groups
}

console.log(match("/user/:name", "http://example.net/user/ray"))
