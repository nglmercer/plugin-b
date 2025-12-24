const targets = [
  { name: "Windows x64", target: "bun-windows-x64", outfile: "./dist/tts_node.exe" },
  { name: "Linux x64", target: "bun-linux-x64", outfile: "./dist/tts_node-linux" },
  { name: "Linux ARM64", target: "bun-linux-arm64", outfile: "./dist/tts_node-linux-arm64" },
  { name: "macOS ARM64", target: "bun-darwin-arm64", outfile: "./dist/tts_node-mac" },
  { name: "macOS x64", target: "bun-darwin-x64", outfile: "./dist/tts_node-mac-x64" },
] as const;

console.log("🚀 Starting multi-platform build...");

for (const { name, target, outfile } of targets) {
  console.log(`📦 Building for ${name}...`);
  if (!target)continue;
  try {
    const result = await Bun.build({
      entrypoints: ["./src/main.ts"],
      compile: {
        target,
        outfile,
      },
    });

    if (result.success) {
      console.log(`Success: ${outfile}`);
    } else {
      console.error(`Failed: ${outfile}`);
      console.error(result.logs);
    }
  } catch (error) {
    console.error(`Error building for ${name}:`, error);
  }
}

console.log("complete.");
