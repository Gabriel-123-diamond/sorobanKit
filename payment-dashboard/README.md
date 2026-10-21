# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Deployment path configuration

The dashboard's asset base path is controlled by the `VITE_BASE_PATH` environment variable, which is passed to Vite's `base` option in `vite.config.js`.

- **Root deployment** (default): leave `VITE_BASE_PATH` unset. Assets are served root-relative (e.g. `/assets/...`).
- **Subdirectory deployment**: set `VITE_BASE_PATH` to the subdirectory path, including leading and trailing slashes (e.g. `/app/`). Assets are then prefixed accordingly (e.g. `/app/assets/...`).

Example:

```bash
# Build for deployment at https://example.com/app/
VITE_BASE_PATH=/app/ npm run build
```

You can also set `VITE_BASE_PATH` in a local `.env` file (see `.env.example`). The same build can be deployed at any path by rebuilding with the appropriate value.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
