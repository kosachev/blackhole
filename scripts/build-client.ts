import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  { entry: "./client/main.ts", outfile: "gerda_userscript.js" },
  { entry: "./client/shop.ts", outfile: "shop_userscript.js" },
  { entry: "./client/gerdacollection.ts", outfile: "gerdacollection_userscript.js" },
];

const OUT_DIR = "./public";

const getEnvFilePath = () => {
  if (existsSync(resolve("./.env.dev"))) return "./.env.dev";
  if (existsSync(resolve("./.env.prod"))) return "./.env.prod";
  return "./.env.example";
};

const envFile = getEnvFilePath();

if (envFile === "./.env.example") {
  console.warn("⚠️ No env file found, using .env.example");
}

const envContent = readFileSync(resolve(envFile), "utf8");
const match = envContent.match(/BACKEND_BASE=(.*)/);
const backendBase = match ? match[1].trim() : null;

if (!backendBase || !backendBase.startsWith("http")) {
  console.error(`❌ Can't find valid BACKEND_BASE in ${envFile}`);
  process.exit(1);
}

console.log(`🚀 Starting build using ${envFile} (BACKEND_BASE: ${backendBase})`);

const buildTasks = TARGETS.map(async (target) => {
  const result = await Bun.build({
    entrypoints: [target.entry],
    outdir: OUT_DIR,
    naming: target.outfile,
    target: "browser",
    minify: false,
    define: {
      "process.env.BACKEND_BASE": JSON.stringify(backendBase),
    },
  });

  if (!result.success) {
    console.error(`❌ Build failed for ${target.entry}:`);
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  return target.outfile;
});

try {
  const builtFiles = await Promise.all(buildTasks);
  console.log(`✅ Build successful! Created:`);
  builtFiles.forEach((f) => console.log(`   - ${OUT_DIR}/${f}`));
} catch (e) {
  console.error("❌ Unexpected error during build:", e);
  process.exit(1);
}
