/*
 * @ordius/adonisjs-shortlink
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import app from '@adonisjs/core/services/app'

import type ShortlinkService from '../shortlink_service.js'
import type { ResolvedModel } from '../types.js'

let shortlink: ShortlinkService<ResolvedModel>

await app.booted(async () => {
  shortlink = await app.container.make('shortlink')
})

export { shortlink as default }
