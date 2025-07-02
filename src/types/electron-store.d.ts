/**
 * Temporary type declarations for electron-store
 * This provides proper typing for electron-store methods
 * TODO: Remove this file when electron-store types are properly updated
 */
declare module 'electron-store' {
  interface StoreOptions<T = Record<string, unknown>> {
    name?: string;
    defaults?: T;
    cwd?: string;
    encryptionKey?: string;
    fileExtension?: string;
    clearInvalidConfig?: boolean;
    serialize?: (value: T) => string;
    deserialize?: (text: string) => T;
    projectSuffix?: string;
    schema?: any;
    migrations?: any;
    beforeEachMigration?: (store: Store<T>, context: any) => void;
    accessPropertiesByDotNotation?: boolean;
  }

  class Store<T = Record<string, unknown>> {
    constructor(options?: StoreOptions<T>);

    /**
     * Get an item from the store
     * @param key - The key to get
     * @param defaultValue - Default value if key doesn't exist
     */
    get<K extends keyof T>(key: K): T[K];
    get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
    get(key: string): unknown;
    get(key: string, defaultValue: unknown): unknown;

    /**
     * Set an item in the store
     * @param key - The key to set
     * @param value - The value to set
     */
    set<K extends keyof T>(key: K, value: T[K]): void;
    set(key: string, value: unknown): void;
    set(object: Partial<T>): void;

    /**
     * Get the path to the store file
     */
    readonly path: string;

    /**
     * Check if a key exists in the store
     * @param key - The key to check
     */
    has(key: string): boolean;

    /**
     * Delete a key from the store
     * @param key - The key to delete
     */
    delete(key: string): void;

    /**
     * Clear all data from the store
     */
    clear(): void;

    /**
     * Get the size of the store
     */
    readonly size: number;

    /**
     * Get the store data as an object
     */
    readonly store: T;

    /**
     * Open the config file in the user's editor
     */
    openInEditor(): void;
  }

  export = Store;
}
