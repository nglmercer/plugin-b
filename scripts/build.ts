const targets = [
  { name: "Windows x64", outfile: "./dist/tts_node.exe" },
  { name: "Linux x64", outfile: "./dist/tts_node-linux" },
  { name: "Linux ARM64", outfile: "./dist/tts_node-linux-arm64" },
  { name: "macOS ARM64", outfile: "./dist/tts_node-mac" },
  { name: "macOS x64", outfile: "./dist/tts_node-mac-x64" },
] as const;

console.log("🚀 Starting multi-platform build...");

for (const { name, outfile } of targets) {
  console.log(`📦 Building for ${name}...`);
  try {
    const result = await Bun.build({
      entrypoints: ["./src/main.ts"],
      target: "bun",
      compile: {
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
