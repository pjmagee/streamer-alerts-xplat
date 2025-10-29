import js from "@eslint/js";
import globals from "globals";
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    // Global ignores
    {
        ignores: [
            ".vite/**",
            "out/**", 
            "dist/**",
            "node_modules/**",
            "coverage/**",
            "chromium/**",
            "chrome/**"
        ]
    },
    
    // JavaScript files
    {
        files: ["**/*.{js,mjs}"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            ecmaVersion: "latest",
            sourceType: "module"
        },
        ...js.configs.recommended,
    },
    
    // TypeScript files
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                // Add Electron and Node.js globals
                NodeJS: 'readonly',
                Electron: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                global: 'readonly'
            },
            parser: tsparser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./tsconfig.json"
            }
        },
        plugins: {
            '@typescript-eslint': tseslint
        },
        rules: {
            ...js.configs.recommended.rules,
            ...tseslint.configs.recommended.rules,
            // Custom rules
            'no-console': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            // Turn off no-undef for TypeScript files since TypeScript handles this
            'no-undef': 'off'
        }
    }
    ,
    // File specific override: allow console in renderer logger
    {
        files: ["src/utils/renderer-logger.ts"],
        rules: {
            'no-console': 'off'
        }
    }
    ,
    {
        files: ["scripts/verify-browser.ts"],
        rules: {
            'no-console': 'off'
        }
    }
];