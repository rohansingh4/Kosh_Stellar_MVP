import { fileURLToPath, URL } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '../../.env' });

// Function to get canister environment variables
function initCanisterEnv() {
  let localCanisters, prodCanisters;
  
  try {
    const localCanisterIds = fs.readFileSync(path.resolve("../../.dfx/local/canister_ids.json"));
    localCanisters = JSON.parse(localCanisterIds);
  } catch (error) {
    console.log("No local canister_ids.json found. Continuing with production");
  }
  
  try {
    const prodCanisterIds = fs.readFileSync(path.resolve("../../canister_ids.json"));
    prodCanisters = JSON.parse(prodCanisterIds);
  } catch (error) {
    console.log("No production canister_ids.json found. Continuing with local");
  }

  const network = process.env.DFX_NETWORK || (process.env.NODE_ENV === "production" ? "ic" : "local");
  const canisterConfig = network === "local" ? localCanisters : prodCanisters;

  if (!canisterConfig) {
    return {};
  }

  const canisterEnvVariables = Object.entries(canisterConfig).reduce((prev, [canisterName, canisterDetails]) => {
    prev[canisterName.toUpperCase() + "_CANISTER_ID"] = canisterDetails[network];
    return prev;
  }, {});

  // Generate Internet Identity URL
  const internetIdentityUrl = network === "local" 
    ? `http://${canisterEnvVariables["INTERNET_IDENTITY_CANISTER_ID"]}.localhost:4943/`
    : `https://identity.ic0.app`;

  return {
    ...canisterEnvVariables,
    II_URL: internetIdentityUrl,
    DFX_NETWORK: network
  };
}

const canisterEnvVariables = initCanisterEnv();

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment({
      ...canisterEnvVariables,
      NODE_ENV: process.env.NODE_ENV || "development"
    }),
  ],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(
          new URL("../declarations", import.meta.url)
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(
          new URL("./src", import.meta.url)
        ),
      },
    ],
    dedupe: ['@dfinity/agent'],
  },
});
