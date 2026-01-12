import { readdir, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const PLUGINS_DIR = "plugins";
const DIST_PLUGINS_DIR = "dist/plugins";

async function buildPlugins() {
  console.log("🔌 Building plugins...");

  // Ensure dist/plugins exists
  if (!existsSync(DIST_PLUGINS_DIR)) {
    await mkdir(DIST_PLUGINS_DIR, { recursive: true });
  }

  // Get all .ts files in plugins dir
  const files = await readdir(PLUGINS_DIR);
  // Filter for plugin files: ends with .ts, not .d.ts, and usually we want to avoid bundling helpers directly as entrypoints unless they are plugins
  // Heuristic: If it handles 'helpers' or 'utils' maybe skip? 
  // User has 'helpers.ts'. It's likely a dependency, not a plugin entrypoint.
  // We can filter out 'helpers.ts' specifically or rely on a naming convention.
  // Let's exclude 'helpers.ts' for now.
  const entrypoints = files.filter(f => 
    f.endsWith(".ts") && 
    !f.endsWith(".d.ts") && 
    f !== "helpers.ts"
  );

  if (entrypoints.length === 0) {
    console.log("⚠️ No plugins found to build.");
    return;
  }

  const results = await Bun.build({
    entrypoints: entrypoints.map(e => join(PLUGINS_DIR, e)),
    outdir: DIST_PLUGINS_DIR,
    target: "bun",
    minify: true,
    sourcemap: "external", // Good for debugging
  });

  if (results.success) {
    console.log(`Successfully built ${entrypoints.length} plugins to ${DIST_PLUGINS_DIR}`);
    entrypoints.forEach(e => console.log(`   - ${e}`));
  } else {
    console.error("Plugin build failed");
    console.error(results.logs);
    process.exit(1);
  }

  // Copy helper scripts that are referenced by runtime paths (not imported)
  // Automatically copy any script in 'scripts/' that isn't a build script.
  const SCRIPTS_SRC = "scripts";
  const SCRIPTS_DEST = "dist/scripts";
  await mkdir(SCRIPTS_DEST, { recursive: true });

  const allScripts = await readdir(SCRIPTS_SRC);
  
  // Exclude known build scripts. We assume any other .ts/.js file in scripts/ is a runtime helper.
  const runtimeScripts = allScripts.filter(file => {
      // Only copy typescript/javascript files
      if (!file.endsWith('.ts') && !file.endsWith('.js')) return false;
      
      // Exclude build scripts (convention: start with 'build')
      if (file.startsWith('build')) return false;
      
      return true;
  });

  if (runtimeScripts.length > 0) {
      console.log(`📂 Copying ${runtimeScripts.length} runtime scripts...`);
      for (const file of runtimeScripts) {
          const src = join(SCRIPTS_SRC, file);
          const dest = join(SCRIPTS_DEST, file);
          await copyFile(src, dest);
          console.log(`   copy ${file} -> ${SCRIPTS_DEST}`);
      }
  }
}

if (import.meta.main) {
  buildPlugins();
}
