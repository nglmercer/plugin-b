import { PluginManager } from "bun_plugins";
import { ActionRegistry, RuleEngine } from "trigger_system/node";
import { join } from "node:path";
import { ActionRegistryPlugin } from "./RegisterPlugin";
import { RuleTesterPlugin } from "../../plugins/TesterPlugin";
import { ensureDir } from "../utils/filepath";
import { webclass } from "./webview";
/**
 * Gestor de plugins personalizado para TTS
 * Extiende PluginManager para asegurar que el ActionRegistryPlugin esté siempre cargado
 */
export class BasePluginManager extends PluginManager {
  public engine: RuleEngine;

  constructor() {
    super();
    // Inicializar el motor de reglas
    this.engine = new RuleEngine({ rules: [], globalSettings: { debugMode: true } });
    
    // Registrar los plugins core automáticamente
    this.register(new ActionRegistryPlugin());
    this.register(new RuleTesterPlugin());
    this.register(new webclass());
    console.log("📦 BasePluginManager: Plugins ActionRegistry y RuleTester registrados");
  }

  /**
   * Carga plugins desde el directorio configurado por defecto
   */
  async loadDefaultPlugins() {
    const pluginsDir = join(process.cwd(), "plugins");
    await ensureDir(pluginsDir);
    await this.loadPluginsFromDirectory(pluginsDir);
    return this.listPlugins();
  }
}