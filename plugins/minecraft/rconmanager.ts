import { Rcon } from "rcon-client";

/**
 * Configuration options for RconManager
 */
export interface RconConfig {
    host?: string;
    port?: number;
    password: string;
    timeout?: number;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    on?: RconEventCallbacks;
}

/**
 * Event callback functions
 */
export interface RconEventCallbacks {
    connected?: () => void;
    disconnected?: () => void;
    error?: (error: Error) => void;
    maxReconnectAttemptsReached?: () => void;
    commandQueued?: (commands: string[], queueLength: number) => void;
    queueProcessed?: (count: number) => void;
}

/**
 * Valid event names
 */
export type RconEventName = keyof RconEventCallbacks;

/**
 * Command queue item
 */
interface QueuedCommand {
    command: string;
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
}

/**
 * Singleton RCON Manager for managing server connections
 */
export class RconManager {
    private static instance: RconManager;
    private rcon: Rcon | null = null;
    private config: Required<Omit<RconConfig, 'on'>> & { on: RconEventCallbacks };
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private commandQueue: QueuedCommand[] = [];
    private isProcessingQueue: boolean = false;

    private constructor(config: RconConfig) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 27015,
            password: config.password,
            timeout: config.timeout || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 3000,
            on: config.on || {}
        };
    }

    /**
     * Get or create the singleton instance
     */
    public static getInstance(config?: RconConfig): RconManager {
        if (!RconManager.instance) {
            if (!config) {
                throw new Error('RconManager must be initialized with config on first call');
            }
            RconManager.instance = new RconManager(config);
        }
        return RconManager.instance;
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    public static resetInstance(): void {
        if (RconManager.instance) {
            RconManager.instance.disconnect();
            RconManager.instance = null as any;
        }
    }

    /**
     * Connect to the RCON server
     */
    public async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }

        this.isConnecting = true;

        try {
            this.rcon = await Rcon.connect({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                timeout: this.config.timeout
            });

            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;

            this.emit('connected');
            this.processQueue();
        } catch (error) {
            this.isConnecting = false;
            this.handleConnectionError(error as Error);
            throw error;
        }
    }

    /**
     * Disconnect from the RCON server
     */
    public async disconnect(): Promise<void> {
        if (this.rcon) {
            try {
                await this.rcon.end();
            } catch (error) {
                // Ignore errors during disconnect
            }
            this.rcon = null;
        }
        this.isConnected = false;
        this.emit('disconnected');
    }

    /**
     * Send a command to the RCON server
     */
    public async send(command: string): Promise<string> {
        if (!this.isConnected || !this.rcon) {
            return this.queueCommand(command);
        }

        try {
            const response = await this.rcon.send(command);
            return response;
        } catch (error) {
            this.handleCommandError(error as Error);
            return this.queueCommand(command);
        }
    }

    /**
     * Send multiple commands
     */
    public async sendMultiple(commands: string[]): Promise<string[]> {
        const promises = commands.map(cmd => this.send(cmd));
        return Promise.all(promises);
    }

    /**
     * Queue a command for later execution
     */
    private queueCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.commandQueue.push({ command, resolve, reject });
            this.emit('commandQueued', [command], this.commandQueue.length);
            
            // Attempt to reconnect if not already connecting
            if (!this.isConnecting && !this.isConnected) {
                this.attemptReconnect();
            }
        });
    }

    /**
     * Process queued commands
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.commandQueue.length === 0 || !this.isConnected) {
            return;
        }

        this.isProcessingQueue = true;
        const processedCount = this.commandQueue.length;

        while (this.commandQueue.length > 0 && this.isConnected) {
            const item = this.commandQueue.shift()!;
            
            try {
                const response = await this.rcon!.send(item.command);
                item.resolve(response);
            } catch (error) {
                item.reject(error as Error);
            }
        }

        this.isProcessingQueue = false;
        this.emit('queueProcessed', processedCount);
    }

    /**
     * Attempt to reconnect to the server
     */
    private async attemptReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.emit('maxReconnectAttemptsReached');
            this.rejectQueuedCommands(new Error('Max reconnect attempts reached'));
            return;
        }

        this.reconnectAttempts++;

        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay));

        try {
            await this.connect();
        } catch (error) {
            // connect() will call handleConnectionError which may trigger another reconnect
        }
    }

    /**
     * Handle connection errors
     */
    private handleConnectionError(error: Error): void {
        this.isConnected = false;
        this.emit('error', error);
        
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.attemptReconnect();
        } else {
            this.emit('maxReconnectAttemptsReached');
            this.rejectQueuedCommands(error);
        }
    }

    /**
     * Handle command execution errors
     */
    private handleCommandError(error: Error): void {
        this.isConnected = false;
        this.emit('error', error);
        this.attemptReconnect();
    }

    /**
     * Reject all queued commands
     */
    private rejectQueuedCommands(error: Error): void {
        while (this.commandQueue.length > 0) {
            const item = this.commandQueue.shift()!;
            item.reject(error);
        }
    }

    /**
     * Emit an event
     */
    private emit(eventName: RconEventName, ...args: any[]): void {
        const callback = this.config.on[eventName];
        if (callback) {
            (callback as any)(...args);
        }
    }

    /**
     * Register event callbacks (can be called after initialization)
     */
    public on(eventName: RconEventName, callback: Function): void {
        this.config.on[eventName] = callback as any;
    }

    /**
     * Get connection status
     */
    public getStatus(): {
        isConnected: boolean;
        isConnecting: boolean;
        reconnectAttempts: number;
        queueLength: number;
    } {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            queueLength: this.commandQueue.length
        };
    }

    /**
     * Update configuration (only affects new connections)
     */
    public updateConfig(config: Partial<RconConfig>): void {
        if (config.host !== undefined) this.config.host = config.host;
        if (config.port !== undefined) this.config.port = config.port;
        if (config.password !== undefined) this.config.password = config.password;
        if (config.timeout !== undefined) this.config.timeout = config.timeout;
        if (config.maxReconnectAttempts !== undefined) {
            this.config.maxReconnectAttempts = config.maxReconnectAttempts;
        }
        if (config.reconnectDelay !== undefined) {
            this.config.reconnectDelay = config.reconnectDelay;
        }
        if (config.on !== undefined) {
            this.config.on = { ...this.config.on, ...config.on };
        }
    }
}