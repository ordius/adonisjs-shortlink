import { configProvider } from '@adonisjs/core'
import { RuntimeException } from '@adonisjs/core/exceptions'
import type { ApplicationService } from '@adonisjs/core/types'

import ShortlinkService from '../src/shortlink_service.js'
import type { ResolvedShortlinkConfig } from '../src/types.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    shortlink: ShortlinkService
  }
}

/**
 * Registers the shortlink service as a container singleton, resolving
 * `config/shortlink.ts` (a config provider) on first use.
 */
export default class ShortlinkProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(ShortlinkService, async () => {
      const config = await configProvider.resolve<ResolvedShortlinkConfig<any>>(
        this.app,
        this.app.config.get('shortlink')
      )

      if (!config) {
        throw new RuntimeException(
          'Invalid "config/shortlink.ts" file. Make sure you are using the "defineConfig" method'
        )
      }

      return new ShortlinkService(config)
    })

    this.app.container.alias('shortlink', ShortlinkService)
  }
}
