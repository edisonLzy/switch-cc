/// <reference types="vite/client" />

declare global {
  interface Window {
    api: import("./lib/tauri-api").TauriAPI;
  }
}

export {};
