/**
 * Allow side-effect CSS imports (e.g. `import "./globals.css"`).
  * Newer TypeScript versions error on these without a module declaration.
   */
declare module "*.css";
