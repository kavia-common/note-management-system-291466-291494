# Notes Frontend (Tizen Web)

This app is built with React and Vite 5 (Node 18 compatible). To run locally:
- npm install
- npm run dev

The dev server binds to 0.0.0.0:3000 so it is reachable from the host/container environment.

Build/package:
- npm run build
- npm run preview

Preview also binds to 0.0.0.0:3000.

If builds fail with a Vite 7.x on Node 18 error:
- Run: npm run fix:deps:vite5
- Then: npm run build or npm run build:auto

Node compatibility:
- This project pins Vite 5.x and @vitejs/plugin-react 4.x for Node 18 support. If you see an error that Vite requires Node 20+, ensure dependencies are installed fresh (no preexisting lockfiles from other Node versions) and respect the engines field.
- If the environment previously installed with a different Node version, run: rm -rf node_modules package-lock.json && npm ci
- CI note: a postinstall check ensures vite 5.x is installed; if it fails with vite 7.x on Node 18, clean install is required.
