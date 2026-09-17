/**
 * @ordius/adonisjs-shortlink
 *
 * A standalone URL shortener service for AdonisJS v7
 */

export { default as ShortlinkService } from './src/shortlink_service.js'
export { default as ShortlinkProvider } from './providers/shortlink_provider.js'
export { defineConfig } from './src/define_config.js'
export { stubsRoot } from './stubs/main.js'
export { configure } from './configure.js'
export * as errors from './src/errors.js'
export * from './src/types.js'
