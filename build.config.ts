import { defineBuildConfig } from "unbuild"

export default defineBuildConfig([
    {
        name: "ServeRouter",
        externals: ["undici"],
        rollup: {
            // esbuild: {
            //     minify: true,
            // },
            output: {
                exports: "named",
            },
        },
    },
])
