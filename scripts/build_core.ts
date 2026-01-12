import { $ } from "bun";

async function main() {
  // Define all possible supported targets
  const allTargets = [
    { os: "win32", arch: "x64", target: "bun-windows-x64", outfile: "dist/plugin-b.exe", name: "Windows x64" },
    { os: "linux", arch: "x64", target: "bun-linux-x64", outfile: "dist/plugin-b-linux", name: "Linux x64" },
    { os: "linux", arch: "arm64", target: "bun-linux-arm64", outfile: "dist/plugin-b-linux-arm64", name: "Linux ARM64" },
    { os: "darwin", arch: "x64", target: "bun-darwin-x64", outfile: "dist/plugin-b-mac-x64", name: "macOS x64" },
    { os: "darwin", arch: "arm64", target: "bun-darwin-arm64", outfile: "dist/plugin-b-mac", name: "macOS ARM64" },
  ];

  const currentPlatform = process.platform;
  const currentArch = process.arch;
  
  const targetsToBuild = [];

  // 1. Always build for the current platform (Native)
  const nativeTarget = allTargets.find(t => t.os === currentPlatform && t.arch === currentArch);
  if (nativeTarget) {
    targetsToBuild.push(nativeTarget);
  } else {
    // Fallback if current env is weird/unsupported, try to construct one or warn
    console.warn(`⚠️  Current environment (${currentPlatform}-${currentArch}) not found in preset targets.`);
  }

  // 2. Always ensure Windows target is built (Primary Deliverable), unless it was already added as native
  const windowsTarget = allTargets.find(t => t.target === "bun-windows-x64");
  if (windowsTarget && !targetsToBuild.some(t => t.target === windowsTarget.target)) {
    targetsToBuild.push(windowsTarget);
  }
  
  // 3. (Optional) If in CI, we could try to enable all, but let's stick to safe defaults for now to avoid the original error.
  // If you want to force all targets in CI (and accept potential failures), uncomment below:
  // if (process.env.CI) {
  //    for (const t of allTargets) {
  //        if (!targetsToBuild.includes(t)) targetsToBuild.push(t);
  //    }
  // }

  console.log("🚀 Starting core build process...");
  console.log(`ℹ️  Host System: ${currentPlatform} (${currentArch})`);
  console.log(`🎯 Active Targets: ${targetsToBuild.map(t => t.name).join(", ")}`);

    let hasErrors = [];
    
    for (const { name, target, outfile } of targetsToBuild) {
        console.log(`📦 Building for ${name} (${target})...`);
        try {
            await $`bun build --compile --target=${target} ./src/main.ts --outfile ${outfile}`;
            console.log(`   ✅ Success: ${outfile}`);
        } catch (error) {
            console.error(`   ❌ Failed to build for ${name}:`);
            console.error(error); // Log the error details
            hasErrors.push(error);
        }
    }

    if (hasErrors.length > 0) {
        console.error("Errors:", hasErrors);
        process.exit(1);
    } else {
        console.log("completed.");
    }
}

await main();
