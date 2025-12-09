# Dependency auto-correction

This project targets Node 18 with Vite 5.x and @vitejs/plugin-react 4.x.

To prevent accidental installs of Vite 7 (which requires Node 20+), the following are in place:
- .npmrc with engine-strict=true
- engines constraint in package.json
- postinstall check which fails if vite is not 5.x
- prepare script which auto-installs vite@5.4.11 and @vitejs/plugin-react@4.3.4 if a wrong major is present
- build-time guard verifying vite 5.x before running the build

If CI still resolves vite 7, clear node_modules and run `npm ci`.
