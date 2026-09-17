![@ordius/adonisjs-shortlink](https://socialify.git.ci/mixxtor/adonisjs-shortlink/image?description=1&descriptionEditable=URL%20shortener%20service%20for%20AdonisJS%20v7.&font=Jost&forks=1&issues=1&logo=https://raw.githubusercontent.com/mixxtor/adonisjs-shortlink/1277869dc1a89bac3ef9764d42637b5b81103daf/logo.svg&name=1&owner=1&pattern=Charlie%20Brown&pulls=1&stargazers=1&theme=Auto)

# @ordius/adonisjs-shortlink

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![AdonisJS](https://img.shields.io/badge/AdonisJS-7.x-purple)

A standalone URL shortener service for AdonisJS v7. Bring your own Lucid model, get a
type-safe, stateless service for creating, resolving and tracking shortlinks across one or
more domains.

> This is v2, a breaking rewrite. 1.x lives on npm as `@mixxtor/adonisjs-shortlink` and is
> untouched — see [Migrating from 1.x](#migrating-from-1x) if you're coming from it.

## Install

```bash
node ace add @ordius/adonisjs-shortlink
```

This prompts you to also generate a redirect controller and routes file, then:

- publishes `config/shortlink.ts`
- publishes `app/models/shortlink.ts`
- publishes a `database/migrations/*_create_shortlinks_table.ts` migration
- registers the provider in `adonisrc.ts`
- adds `SHORTLINK_DOMAIN` to `.env` (and its validation in `start/env.ts`)

Then run the migration and set the domain:

```bash
node ace migration:run
```

```env
SHORTLINK_DOMAIN=short.yourdomain.com
```

## Config reference

`config/shortlink.ts` calls `defineConfig(...)`, which returns a config provider — validated
and defaulted lazily, once the app resolves it (not at import time).

| Key                  | Type                                | Default                    | Notes                                                                                                                     |
| -------------------- | ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `model`              | `() => Promise<{ default: Model }>` | —                          | Required. Lazy import, e.g. `() => import('#models/shortlink')`                                                           |
| `domain`             | `string`                            | —                          | Required. Bare host or full URL — normalized to a hostname                                                                |
| `domains`            | `string[]`                          | `[]`                       | Extra hosts served alongside `domain`                                                                                     |
| `protocol`           | `'http' \| 'https'`                 | `'https'`                  |                                                                                                                           |
| `prefix`             | `string`                            | `''`                       | Normalized to `''` or `/x`, no trailing slash                                                                             |
| `redirectStatusCode` | `301 \| 302 \| 307 \| 308`          | `302`                      | 301 is cached forever by browsers — a slug repointed to a new URL would keep redirecting old visitors to the previous one |
| `trackClicks`        | `boolean`                           | `true`                     |                                                                                                                           |
| `slug.length`        | `number`                            | `8`                        | Minimum 4                                                                                                                 |
| `slug.alphabet`      | `string`                            | base62 (`A-Za-z0-9`)       | At least 2 unique characters                                                                                              |
| `slug.pattern`       | `RegExp`                            | `/^[A-Za-z0-9_-]{1,255}$/` | Validates both custom and generated slugs                                                                                 |
| `slug.reserved`      | `string[]`                          | `[]`                       | Case-insensitive                                                                                                          |
| `slug.maxAttempts`   | `number`                            | `5`                        | Collision retries for generated slugs                                                                                     |
| `allowedProtocols`   | `string[]`                          | `['http:', 'https:']`      | Checked against `new URL(originalUrl).protocol`                                                                           |

```ts
import env from '#start/env'
import { defineConfig } from '@ordius/adonisjs-shortlink'
import type { InferShortlinkModel } from '@ordius/adonisjs-shortlink/types'

const shortlinkConfig = defineConfig({
  model: () => import('#models/shortlink'),
  domain: env.get('SHORTLINK_DOMAIN'),
  domains: ['legacy-short.example.com'],
  prefix: 's',
  slug: { reserved: ['api', 'admin'] },
})

export default shortlinkConfig

declare module '@ordius/adonisjs-shortlink/types' {
  interface ShortlinkModels extends InferShortlinkModel<typeof shortlinkConfig> {}
}
```

The `declare module` block types the `shortlink` service (and its container binding) with
your model — that's how `service.find()` etc. return `InstanceType<YourModel>` instead of the
generic base type.

## Model contract

Your model owns its table and connection (plain Lucid, no config coupling) and must expose
these camelCase attributes — the default naming strategy maps them to snake_case columns:

```ts
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Shortlink extends BaseModel {
  static table = 'shortlinks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare domain: string

  @column()
  declare slug: string

  @column()
  declare originalUrl: string

  @column()
  declare clicks: number

  @column({
    prepare: (value: Record<string, unknown> | null) => JSON.stringify(value),
    // pg's jsonb driver already returns an object — only parse a raw string
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

Add whatever extra columns you need (`referer`, `createdBy`, `group`, ...) — they're reachable
through `attributes` on `create`/`update`. The migration enforces uniqueness on
`(domain, slug)`, not `slug` alone.

## Service API

Everything goes through the `shortlink` service — a stateless class, generic over your model:

```ts
import shortlink from '@ordius/adonisjs-shortlink/services/main'
```

### URLs (pure)

```ts
shortlink.url('abc123') // 'https://short.example.com/s/abc123'
shortlink.url('abc123', { domain: 'other.example.com' }) // throws E_UNKNOWN_DOMAIN
shortlink.parse('https://short.example.com/s/abc123') // { domain, slug } | null
shortlink.servesDomain('short.example.com') // boolean
```

### Slugs (pure)

```ts
shortlink.generateSlug() // crypto.randomInt-based, unbiased
shortlink.isReserved('admin') // boolean, case-insensitive
shortlink.assertValidSlug('my-slug') // throws E_INVALID_SLUG / E_SLUG_RESERVED
```

### Reads

A domain defaults to the primary one; an unconfigured domain returns `null` (it never throws
on a read — only writes do, since an unknown domain there is a caller mistake worth
surfacing).

```ts
await shortlink.find(id)
await shortlink.findBySlug('abc123', { domain: 'short.example.com' })
await shortlink.findByUrl('https://example.com/a')
```

### Writes

```ts
// Generated slug
const link = await shortlink.create('https://example.com/a')

// Custom slug, extra domain, extra columns
const admin = await shortlink.create('https://example.com/a', {
  slug: 'summer-sale',
  domain: 'short.example.com',
  metadata: { campaign: 'summer' },
  attributes: { createdBy: user.id },
})

// By URL + domain, idempotent for sequential calls
const link2 = await shortlink.firstOrCreate('https://example.com/a')

await shortlink.update(link, { originalUrl: 'https://example.com/b' })
await shortlink.delete(link)
```

Original URLs are validated (`new URL()` must parse, protocol must be in
`allowedProtocols`) and stored exactly as given — never rewritten. `attributes` can never
override `id`/`slug`/`domain`/`originalUrl`/`clicks`, regardless of what you pass.

Custom slugs are validated then checked for availability; a race that still hits the unique
index comes back as `E_SLUG_TAKEN` rather than a raw database error. Generated slugs retry up
to `slug.maxAttempts` times on collision — except inside a transaction you passed in via
`client`, where a failed insert would abort it, so there's exactly one attempt.

### Clicks

```ts
await shortlink.recordClick(link) // or shortlink.recordClick(link.id, 5)
```

An atomic `increment('clicks', n)` — it never touches `updatedAt` and never fires model hooks,
so concurrent redirects can't lose counts the way `clicks += 1; save()` would.

### Redirect controller example

Generated for you if you accept the setup prompt (`app/controllers/shortlinks_controller.ts`,
preloaded via `#start/shortlinks`):

```ts
import type { HttpContext } from '@adonisjs/core/http'
import shortlink from '@ordius/adonisjs-shortlink/services/main'

export default class ShortlinksController {
  async redirect({ params, request, response, logger }: HttpContext) {
    const link = await shortlink.findBySlug(params.slug, {
      domain: request.hostname() ?? undefined,
    })

    if (!link) return response.notFound({ error: 'Shortlink not found' })

    if (shortlink.config.trackClicks) {
      shortlink.recordClick(link).catch((error) => logger.error({ err: error }, 'click failed'))
    }

    return response.redirect().status(shortlink.config.redirectStatusCode).toPath(link.originalUrl)
  }
}
```

Management endpoints (create/update/delete) are intentionally **not** generated — wire them up
in your own app, behind auth.

### Multi-domain

Configure `domains`, and the generated routes file registers one `GET ${prefix}/:slug` per
domain via `.domain()`. Reads/writes scope to a domain through the `domain` option (defaulting
to the primary one).

## Errors

All thrown via `createError`, so you can branch on `error.code` instead of parsing messages:

| Export                     | `code`                               | status |
| -------------------------- | ------------------------------------ | ------ |
| `E_SLUG_TAKEN`             | `E_SHORTLINK_SLUG_TAKEN`             | 409    |
| `E_SLUG_RESERVED`          | `E_SHORTLINK_SLUG_RESERVED`          | 422    |
| `E_INVALID_SLUG`           | `E_SHORTLINK_INVALID_SLUG`           | 422    |
| `E_INVALID_URL`            | `E_SHORTLINK_INVALID_URL`            | 422    |
| `E_UNKNOWN_DOMAIN`         | `E_SHORTLINK_UNKNOWN_DOMAIN`         | 422    |
| `E_SLUG_GENERATION_FAILED` | `E_SHORTLINK_SLUG_GENERATION_FAILED` | 500    |

```ts
import { errors } from '@ordius/adonisjs-shortlink'

try {
  await shortlink.create(url, { slug: 'taken' })
} catch (error) {
  if (error instanceof errors.E_SLUG_TAKEN) {
    return response.conflict({ error: error.message })
  }
  throw error
}
```

## Migrating from 1.x

v2 is a breaking rewrite published under a new package name (`@ordius/...` instead of
`@mixxtor/...`), so 1.x apps are unaffected until they opt in. What changed and why:

- **Config is a provider, resolved lazily.** `defineConfig()` used to validate at import time
  and return a plain object; now it returns a `ConfigProvider`, resolved (and validated) once
  the app boots. Read it via the `shortlink` service's `.config`, not by importing the config
  file directly.
- **The service is stateless and generic**, constructed once from the resolved config. There's
  no `setBaseUrl()` mutating shared state for every caller anymore.
- **Clicks are a real atomic increment.** `incrementClicks()` on the model (`clicks += 1;
save()`) is gone — it lost updates under concurrency and bumped `updatedAt`. Use
  `shortlink.recordClick()`.
- **Slugs are generated with `crypto.randomInt`** (unbiased) instead of `byte % length`
  (modulo-biased), and a collision retries a bounded number of times instead of falling back
  to an unchecked longer slug.
- **Errors are typed**, not bare `Error` strings — see the table above.
- **Lookups are unambiguous.** `updateOrCreate(slugOrUrl)` used to match `slug = x OR
original_url = x`, which could hit the wrong row. `firstOrCreate`/`findByUrl` match by URL
  (+ domain) explicitly.
- **URLs are validated.** A `javascript:`/`data:` URL is rejected (`E_INVALID_URL`) instead of
  being stored as a redirect target.
- **Multi-domain support.** `domain`/`domains` replace the single implicit domain; uniqueness
  is scoped to `(domain, slug)`.
- **The model owns its table/connection** — no more `enabled`/`connection`/`tableName` config
  keys that only the model read, creating a config ↔ model import cycle.
- **`luxon` is gone from the package's own dependencies** (it was only used for types and
  risked a second copy). Your model still needs it directly if you use
  `@column.dateTime`, same as any Lucid app.

## License

MIT License — see [LICENSE](./LICENSE) for details.
