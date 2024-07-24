module.exports = {
  entry: {
    client: "./client/main.ts",
  },
  output: {
    path: "./public",
    name: "gerda_userscript.js",
  },
  options: {
    jsc: {
      parser: {
        syntax: "typescript",
      },
      target: "es2022",
    },
    sourceMaps: false,
  },
};
