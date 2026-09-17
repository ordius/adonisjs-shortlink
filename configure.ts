/**
 * Configure hook
 *
 * This file is used to configure the package when installed via `node ace add`
 */

import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'

/**
 * Configures the package
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  /**
   * Publish config file
   */
  await codemods.makeUsingStub(stubsRoot, 'config/shortlink.stub', {
    fileName: 'shortlink.ts',
  })

  /**
   * Publish model file
   */
  await codemods.makeUsingStub(stubsRoot, 'models/shortlink.stub', {
    fileName: 'shortlink.ts',
  })

  /**
   * Publish migration file
   */
  await codemods.makeUsingStub(stubsRoot, 'migrations/create_shortlinks_table.stub', {
    migration: {
      folder: 'database/migrations',
      fileName: `${new Date().getTime()}_create_shortlinks_table.ts`,
    },
  })

  /**
   * Register provider
   */
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@ordius/adonisjs-shortlink/shortlink_provider')
  })

  /**
   * Add environment variables. Everything else (protocol, prefix, slug
   * options, ...) lives in config defaults — only the domain needs an
   * env-specific value per deployment.
   */
  await codemods.defineEnvVariables({
    SHORTLINK_DOMAIN: 'short.domain.com',
  })

  /**
   * Add environment validation
   */
  await codemods.defineEnvValidations({
    leadingComment: 'Shortlink configuration',
    variables: {
      SHORTLINK_DOMAIN: `Env.schema.string({ format: 'host' })`,
    },
  })

  /**
   * Setup the redirect controller and routes
   */
  const setupRoutes = await command.prompt.confirm(
    'Do you want to generate the shortlink redirect controller and routes?',
    { default: true }
  )

  if (setupRoutes) {
    await codemods.makeUsingStub(stubsRoot, 'controllers/shortlinks_controller.stub', {})

    await codemods.makeUsingStub(stubsRoot, 'start/shortlinks.stub', {
      fileName: 'shortlinks.ts',
    })

    await codemods.updateRcFile((rcFile) => {
      rcFile.addPreloadFile('#start/shortlinks')
    })

    command.logger.success('Shortlink controller and routes created')
  }

  command.logger.info('')
  command.logger.info('Next steps:')
  command.logger.info('1. Run "node ace migration:run" to create the shortlinks table')
  command.logger.info('2. Set SHORTLINK_DOMAIN in your .env file')

  if (setupRoutes) {
    command.logger.info(
      '3. Redirects are served from "#start/shortlinks" (preloaded automatically)'
    )
  } else {
    command.logger.info('3. Register redirect routes yourself using the "shortlink" service')
  }
}
