# Production Login Failure Fix (CSP Configuration)

## Problem Description

In the production build of Switch CC, users encountered a "登录失败: Load failed" (Login failed: Load failed) error when attempting to sign in to the configuration cloud sync service. However, the same account and password worked correctly during development.

## Root Cause Analysis

The investigation revealed that the issue was caused by the **Content Security Policy (CSP)** configuration in Tauri.

In a Tauri application, the frontend is restricted from making network requests to domains not explicitly whitelisted in the CSP. During development (`pnpm dev`), these restrictions are often relaxed or bypass due to the development server's environment. However, in the production build, the CSP is strictly enforced.

The `tauri.conf.json` file's `security.csp` directive was missing the production API server's address in the `connect-src` list.

**Previous CSP:**
```json
"csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; connect-src 'self' https://api.github.com https://github.com"
```

Because `http://119.29.80.76:3000` (the backend API) was not included in `connect-src`, the browser engine (WebKit on macOS) blocked the `fetch` request, resulting in the "Load failed" error.

## Solution

The fix involves adding the backend API server's URL to the `connect-src` directive in `src-tauri/tauri.conf.json`.

### Changes in `src-tauri/tauri.conf.json`

```diff
- "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; connect-src 'self' https://api.github.com https://github.com"
+ "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: blob: https:; connect-src 'self' http://119.29.80.76:3000 https://api.github.com https://github.com"
```

## Verification

After applying the change, rebuild the application:

```bash
pnpm build
```

The production executable should now be able to connect to the backend and complete the login process successfully.

## Notes

- Any new external API endpoints used by the application in the future must also be added to the `connect-src` CSP directive to avoid similar "Load failed" errors in production.
- While using an IP address works, it's recommended to use a domain name with HTTPS in the long run for better security.
