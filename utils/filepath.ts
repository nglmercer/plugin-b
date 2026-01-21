import * as fs from "fs";
import * as path from "path";

/**
 * Obtiene el directorio base de la aplicación.
 * - En desarrollo: retorna process.cwd()
 * - En ejecutable compilado: retorna el directorio donde está el ejecutable
 */
function getBaseDir(): string {
    // process.execPath contiene la ruta del ejecutable de Bun
    // En un ejecutable compilado con `bun build --compile`, apunta al ejecutable mismo
    const execPath = process.execPath;
    
    // Detectar si estamos en un ejecutable compilado
    // En desarrollo, execPath apunta a bun (/usr/bin/bun o similar)
    // En compilado, apunta al ejecutable del proyecto
    const isBunRuntime = execPath.includes('/bun') || execPath.includes('\\bun');
    
    if (!isBunRuntime) {
        // Estamos en un ejecutable compilado
        // Retornar el directorio donde está el ejecutable
        return path.dirname(execPath);
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