import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2] ?? "build";
const cwd = process.cwd();

function resolveDistDir(currentMode) {
  if (currentMode === "dev") return ".next-dev";
  return ".next-prod";
}

const distDir = resolveDistDir(mode);
const absDistDir = path.join(cwd, distDir);

if (mode === "dev" || mode === "build") {
  fs.rmSync(absDistDir, { recursive: true, force: true });
  console.log(`[prepare-next-runtime] cleared ${distDir}`);
  process.exit(0);
}

if (mode === "start") {
  if (!fs.existsSync(absDistDir)) {
    console.error(
      `[prepare-next-runtime] build output not found at ${distDir}. Run "npm run build" first.`
    );
    process.exit(1);
  }

  console.log(`[prepare-next-runtime] using ${distDir}`);
  process.exit(0);
}

if (mode === "typecheck") {
  for (const dir of [".next-dev/types", ".next-prod/types"]) {
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
  }

  console.log("[prepare-next-runtime] ensured .next-dev/types and .next-prod/types");
  process.exit(0);
}

console.error(`[prepare-next-runtime] unknown mode: ${mode}`);
process.exit(1);
