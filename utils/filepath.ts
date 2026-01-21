import * as fs from "fs";
import * as path from "path";

/**
 * Obtiene el directorio base de la aplicación.
 * - En desarrollo: retorna process.cwd()
 * - En ejecutable compilado: retorna el directorio donde está el ejecutable
 */
function getBaseDir(): string {
    // Bun.main contiene la ruta del archivo principal ejecutado
    // En un ejecutable compilado, apunta al ejecutable mismo
    if (Bun.main) {
        const mainPath = Bun.main;
        // Si termina en .exe o no tiene extensión (binario de Linux/Mac), es un ejecutable
        const isCompiled = mainPath.endsWith('.exe') || 
                          (!path.extname(mainPath) && !mainPath.includes('node_modules'));
        
        if (isCompiled) {
            // Retornar el directorio del ejecutable
            return path.dirname(mainPath);
        }
    }
    
    // En desarrollo, usar process.cwd()
    return process.cwd();
}

function ensureDir(Path:string){
    if (!fs.existsSync(Path)) {
        fs.mkdirSync(Path, { recursive: true });
    }
    return fs.existsSync(Path);
}

export { ensureDir, getBaseDir }