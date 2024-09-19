import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exit } from "node:process";

const TARGET_FILES = ["./public/gerda_userscript.js", "./public/shop_userscript.js"];

// const OUTPUT_USERSCRIPT = "./public/gerda_userscript.js";

const env_file = existsSync(resolve("./.env.dev"))
  ? "./.env.dev"
  : existsSync(resolve("./.env.prod"))
    ? "./.env.prod"
    : "./.env.example";

if (env_file === "./.env.example") {
  console.warn("No env file found, using .env.example");
}

const env = readFileSync(resolve(env_file), "utf8");
if (!env) {
  console.error("Can't read env file");
  exit(1);
}

const backend_base = env.match(/BACKEND_BASE=(.*)/)[1];

if (!backend_base || !backend_base.startsWith("http")) {
  console.error("Can't find BACKEND_BASE in env file");
  exit(1);
}

for (const file of TARGET_FILES) {
  let client_file = readFileSync(resolve(file), "utf8");
  client_file = client_file.replace("process.env.BACKEND_BASE", `"${backend_base}"`);
  writeFileSync(resolve(file), client_file);
}

console.log(`Finish inlining data, used ${env_file} and BACKEND_BASE ${backend_base}`);
