// just for type
import type {} from "urlpattern-polyfill"

/**
 * @example
 * match("/user/:name", "http://example.net/user/ray") // => { name: "ray" }
 */
export function match(path: string, url: string) {
    const u = new URL(url)
    const pattern = new URLPattern(path, u.origin)
    return pattern.exec(url)?.pathname.groups
}
