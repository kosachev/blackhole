const TARGETS = [
  { entry: "./apps/userscripts/amo/amo.ts", outfile: "gerda_userscript.js" },
  { entry: "./apps/userscripts/gerda-msk/gerda-msk.ts", outfile: "shop_userscript.js" },
  {
    entry: "./apps/userscripts/gerdacollection/gerdacollection.ts",
    outfile: "gerdacollection_userscript.js",
  },
];

const OUT_DIR = "./public";

const backendArg = Bun.argv.find((arg) => arg.startsWith("--backend="));
const backendBase = backendArg ? backendArg.split("=")[1] : "http://localhost:6969";

if (!backendBase.startsWith("http")) {
  console.error(`❌ Invalid BACKEND_BASE provided: "${backendBase}". It must start with 'http'.`);
  process.exit(1);
}

console.log(`🚀 Starting build`);

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

async function buildDbUi(): Promise<string> {
  const result = await Bun.build({
    entrypoints: ["./apps/db-ui/main.ts"],
    target: "browser",
    minify: false,
  });
  if (!result.success || result.outputs.length !== 1) {
    throw new Error(`DB UI build failed: ${result.logs.join("\n")}`);
  }
  const [template, css, script] = await Promise.all([
    Bun.file("./apps/db-ui/index.html").text(),
    Bun.file("./apps/db-ui/style.css").text(),
    result.outputs[0].text(),
  ]);
  const html = template
    .replace("<!-- APP_STYLE -->", () => `<style>${css}</style>`)
    .replace("<!-- APP_SCRIPT -->", () => `<script type="module">${script.replaceAll("</script", "<\\/script")}</script>`);
  await Bun.write(`${OUT_DIR}/db-ui.html`, html);
  return "db-ui.html";
}

buildTasks.push(buildDbUi());

try {
  const builtFiles = await Promise.all(buildTasks);
  console.log(`✅ Build successful! Created:`);
  builtFiles.forEach((f) => console.log(`    ${OUT_DIR}/${f}`));
} catch (e) {
  console.error("❌ Unexpected error during build:", e);
  process.exit(1);
}
