import { defineBuildConfig } from "unbuild"

export default defineBuildConfig([
    {
        name: "ServeRouter",
        externals: ["undici"],
        rollup: {
            esbuild: {
                minify: false,
            },
            output: {
                exports: "named",
            },
        },
    },
])
