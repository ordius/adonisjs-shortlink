import type { DateTime } from 'luxon'
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'
import { EmitterFactory } from '@adonisjs/core/factories/events'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, SnakeCaseNamingStrategy, column } from '@adonisjs/lucid/orm'

import { E_SLUG_TAKEN } from '../../src/errors.js'
import ShortlinkService from '../../src/shortlink_service.js'
import type { ResolvedShortlinkConfig } from '../../src/types.js'

/**
 * A real Lucid model, backed by an in-memory better-sqlite3 database, so
 * these tests exercise the same code paths a real app would hit
 * (attribute → column resolution, unique constraints, atomic increment).
 */
class Shortlink extends BaseModel {
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
    prepare: (value: Record<string, unknown> | null) =>
      value === null || value === undefined ? null : JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare metadata: Record<string, unknown> | null

  // Extra app-owned column, used to prove `attributes` are persisted. Also
  // carries its own unique constraint, so a collision on it can be told
  // apart from a slug collision (see the "unique-violation classification"
  // tests below).
  @column()
  declare referer: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

/**
 * Same table, but mapped through a snake_case naming strategy with
 * snake_case attribute names — proving the service reads column names from
 * the resolved config instead of assuming a camelCase contract (see
 * `ResolvedAttributeMap`).
 */
class SnakeShortlink extends BaseModel {
  static table = 'shortlinks'
  static namingStrategy = new SnakeCaseNamingStrategy()

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare domain: string

  @column()
  declare slug: string

  @column()
  declare original_url: string

  @column()
  declare clicks: number

  @column({
    prepare: (value: Record<string, unknown> | null) =>
      value === null || value === undefined ? null : JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}

function makeConfig(
  overrides: Partial<ResolvedShortlinkConfig<typeof Shortlink>> = {}
): ResolvedShortlinkConfig<typeof Shortlink> {
  return {
    model: Shortlink,
    domain: 'short.example.com',
    domains: ['short.example.com'],
    protocol: 'https',
    prefix: '',
    redirectStatusCode: 302,
    trackClicks: true,
    allowedProtocols: ['http:', 'https:'],
    attributes: {
      domain: 'domain',
      slug: 'slug',
      originalUrl: 'originalUrl',
      clicks: 'clicks',
      metadata: 'metadata',
    },
    slug: {
      length: 8,
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      pattern: /^[A-Za-z0-9_-]{1,255}$/,
      reserved: new Set<string>(),
      maxAttempts: 5,
    },
    ...overrides,
  }
}

function makeSnakeConfig(
  overrides: Partial<ResolvedShortlinkConfig<typeof SnakeShortlink>> = {}
): ResolvedShortlinkConfig<typeof SnakeShortlink> {
  return {
    model: SnakeShortlink,
    domain: 'short.example.com',
    domains: ['short.example.com'],
    protocol: 'https',
    prefix: '',
    redirectStatusCode: 302,
    trackClicks: true,
    allowedProtocols: ['http:', 'https:'],
    attributes: {
      domain: 'domain',
      slug: 'slug',
      originalUrl: 'original_url',
      clicks: 'clicks',
      metadata: 'metadata',
    },
    slug: {
      length: 8,
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      pattern: /^[A-Za-z0-9_-]{1,255}$/,
      reserved: new Set<string>(),
      maxAttempts: 5,
    },
    ...overrides,
  }
}

async function setupDatabase() {
  const app = new AppFactory().create(new URL('./', import.meta.url), () => {})
  const logger = new LoggerFactory().create()
  const emitter = new EmitterFactory().create(app)

  const db = new Database(
    {
      connection: 'sqlite',
      connections: {
        sqlite: {
          client: 'better-sqlite3',
          connection: { filename: ':memory:' },
          useNullAsDefault: true,
        },
      },
    },
    logger,
    emitter
  )

  BaseModel.$adapter = db.modelAdapter()

  const connection = db.connection()
  await connection.schema.createTable('shortlinks', (table) => {
    table.increments('id')
    table.string('domain', 255).notNullable()
    table.string('slug', 255).notNullable()
    table.unique(['domain', 'slug'])
    table.text('original_url').notNullable()
    table.integer('clicks').unsigned().notNullable().defaultTo(0)
    table.json('metadata').nullable()
    table.string('referer').nullable().unique()
    table.timestamp('created_at', { useTz: true })
    table.timestamp('updated_at', { useTz: true })
  })

  return async () => {
    await db.manager.closeAll()
  }
}

test.group('ShortlinkService (integration)', (group) => {
  group.each.setup(setupDatabase)

  test('create with a generated slug', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a')

    assert.equal(link.originalUrl, 'https://example.com/a')
    assert.equal(link.domain, 'short.example.com')
    assert.equal(link.slug.length, 8)
    assert.equal(link.clicks, 0)
  })

  test('create with a custom slug', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a', { slug: 'my-slug' })

    assert.equal(link.slug, 'my-slug')
  })

  test('create throws E_SLUG_TAKEN when the custom slug already exists', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { slug: 'taken' })

    await assert.rejects(async () => {
      try {
        await service.create('https://example.com/b', { slug: 'taken' })
      } catch (error) {
        assert.equal(error.code, 'E_SHORTLINK_SLUG_TAKEN')
        throw error
      }
    })
  })

  test('the same slug is allowed on a different domain', async ({ assert }) => {
    const service = new ShortlinkService(
      makeConfig({ domains: ['short.example.com', 'go.example.com'] })
    )

    const first = await service.create('https://example.com/a', {
      slug: 'shared',
      domain: 'short.example.com',
    })
    const second = await service.create('https://example.com/b', {
      slug: 'shared',
      domain: 'go.example.com',
    })

    assert.equal(first.slug, second.slug)
    assert.notEqual(first.domain, second.domain)
  })

  test('create throws E_SLUG_RESERVED for a reserved slug', async ({ assert }) => {
    const service = new ShortlinkService(
      makeConfig({ slug: { ...makeConfig().slug, reserved: new Set(['admin']) } })
    )

    try {
      await service.create('https://example.com/a', { slug: 'admin' })
      assert.fail('expected create to throw')
    } catch (error) {
      assert.equal(error.code, 'E_SHORTLINK_SLUG_RESERVED')
    }
  })

  test('create throws E_INVALID_URL for a javascript: URL', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())

    try {
      await service.create('javascript:alert(1)')
      assert.fail('expected create to throw')
    } catch (error) {
      assert.equal(error.code, 'E_SHORTLINK_INVALID_URL')
    }
  })

  test('create throws E_UNKNOWN_DOMAIN for an unconfigured domain', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())

    try {
      await service.create('https://example.com/a', { domain: 'other.example.com' })
      assert.fail('expected create to throw')
    } catch (error) {
      assert.equal(error.code, 'E_SHORTLINK_UNKNOWN_DOMAIN')
    }
  })

  test('attributes are persisted but cannot override protected columns', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())

    const link = await service.create('https://example.com/a', {
      slug: 'with-referer',
      attributes: { referer: 'newsletter', slug: 'hijacked' } as any,
    })

    assert.equal(link.referer, 'newsletter')
    assert.equal(link.slug, 'with-referer')
  })

  test('findBySlug is scoped to the given domain', async ({ assert }) => {
    const service = new ShortlinkService(
      makeConfig({ domains: ['short.example.com', 'go.example.com'] })
    )
    await service.create('https://example.com/a', { slug: 'scoped', domain: 'short.example.com' })

    const found = await service.findBySlug('scoped', { domain: 'short.example.com' })
    const notFound = await service.findBySlug('scoped', { domain: 'go.example.com' })

    assert.isNotNull(found)
    assert.isNull(notFound)
  })

  test('firstOrCreate is idempotent for sequential calls', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())

    const first = await service.firstOrCreate('https://example.com/a')
    const second = await service.firstOrCreate('https://example.com/a')

    assert.equal(first.id, second.id)
  })

  test('firstOrCreate matches an untrimmed URL against the stored one', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const first = await service.firstOrCreate('https://example.com/a')
    const second = await service.firstOrCreate('  https://example.com/a  ')

    assert.equal(second.id, first.id)
  })

  test('a generated slug that collides is retried inside a caller transaction', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { slug: 'taken123' })

    const slugs = ['taken123', 'fresh456']
    service.generateSlug = () => slugs.shift()!

    const link = await Shortlink.transaction((trx) =>
      service.create('https://example.com/b', { client: trx })
    )

    assert.equal(link.slug, 'fresh456')
  })

  test('update throws E_SLUG_TAKEN when the new slug is already used on the domain', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { slug: 'existing' })
    const link = await service.create('https://example.com/b', { slug: 'mine' })

    try {
      await service.update(link, { slug: 'existing' })
      assert.fail('expected update to throw')
    } catch (error) {
      assert.equal(error.code, 'E_SHORTLINK_SLUG_TAKEN')
    }
  })

  test('update changes the original URL and metadata', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a')

    const updated = await service.update(link, {
      originalUrl: 'https://example.com/b',
      metadata: { campaign: 'summer' },
    })

    assert.equal(updated.originalUrl, 'https://example.com/b')
    assert.deepEqual(updated.metadata, { campaign: 'summer' })
  })

  test('recordClick increments atomically under concurrency and leaves updatedAt untouched', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a')

    // sqlite stores timestamps with second precision, so compare against a
    // reloaded value rather than the in-memory one (which still carries
    // milliseconds) to avoid a false mismatch.
    const before = await service.find(link.id)
    const updatedAtBefore = before!.updatedAt.toISO()

    await Promise.all(Array.from({ length: 20 }, () => service.recordClick(link.id)))

    const reloaded = await service.find(link.id)
    assert.equal(reloaded!.clicks, 20)
    assert.equal(reloaded!.updatedAt.toISO(), updatedAtBefore)
  })

  test('recordClick runs against an explicit client option', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a')

    const trx = await Shortlink.transaction()
    await service.recordClick(link.id, 3, { client: trx })
    await trx.commit()

    const reloaded = await service.find(link.id)
    assert.equal(reloaded!.clicks, 3)
  })

  test("recordClick falls back to the row's own transaction", async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())

    const link = await Shortlink.transaction(async (trx) => {
      const created = await service.create('https://example.com/a', { client: trx })
      await service.recordClick(created)
      return created
    })

    const reloaded = await service.find(link.id)
    assert.equal(reloaded!.clicks, 1)
  })

  test('delete removes the row', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    const link = await service.create('https://example.com/a')

    await service.delete(link)

    assert.isNull(await service.find(link.id))
  })

  // -----------------------------------------------------------------------
  // Unique-violation classification — a collision on the app's own unique
  // column (`referer`, reachable via `attributes`) must never be reported
  // as a slug collision, and must never be silently swallowed.
  // -----------------------------------------------------------------------

  test('create with a custom slug rethrows the original error for a non-slug unique violation', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', {
      slug: 'first',
      attributes: { referer: 'dup' } as any,
    })

    try {
      await service.create('https://example.com/b', {
        slug: 'second',
        attributes: { referer: 'dup' } as any,
      })
      assert.fail('expected create to throw')
    } catch (error) {
      assert.isFalse(error instanceof E_SLUG_TAKEN)
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_TAKEN')
    }
  })

  test('create with a generated slug rethrows the original error for a non-slug unique violation', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { attributes: { referer: 'dup' } as any })

    try {
      await service.create('https://example.com/b', { attributes: { referer: 'dup' } as any })
      assert.fail('expected create to throw')
    } catch (error) {
      assert.isFalse(error instanceof E_SLUG_TAKEN)
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_GENERATION_FAILED')
    }
  })

  test('create with a custom slug inside a caller transaction rethrows the raw DB error, unwrapped', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { attributes: { referer: 'dup' } as any })

    try {
      // The slug itself is free — the pre-insert check passes — so the
      // unique violation only surfaces once the INSERT hits `referer`'s
      // own constraint, inside the caller's transaction.
      await Shortlink.transaction((trx) =>
        service.create('https://example.com/b', {
          slug: 'free-slug',
          client: trx,
          attributes: { referer: 'dup' } as any,
        })
      )
      assert.fail('expected create to throw')
    } catch (error) {
      assert.isFalse(error instanceof E_SLUG_TAKEN)
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_TAKEN')
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_GENERATION_FAILED')
    }
  })

  test('create with a generated slug inside a caller transaction rethrows the raw DB error, not E_SLUG_GENERATION_FAILED', async ({
    assert,
  }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { attributes: { referer: 'dup' } as any })

    try {
      await Shortlink.transaction((trx) =>
        service.create('https://example.com/b', {
          client: trx,
          attributes: { referer: 'dup' } as any,
        })
      )
      assert.fail('expected create to throw')
    } catch (error) {
      // This is the CodeRabbit-flagged regression: the old code wrapped
      // this in E_SLUG_GENERATION_FAILED({ cause: error }), hiding that the
      // real cause was the app's own `referer` column, not a slug clash.
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_GENERATION_FAILED')
    }
  })

  test('update rethrows the original error for a non-slug unique violation', async ({ assert }) => {
    const service = new ShortlinkService(makeConfig())
    await service.create('https://example.com/a', { attributes: { referer: 'dup' } as any })
    const link = await service.create('https://example.com/b', { slug: 'mine' })

    try {
      await service.update(link, { slug: 'brand-new', attributes: { referer: 'dup' } as any })
      assert.fail('expected update to throw')
    } catch (error) {
      assert.isFalse(error instanceof E_SLUG_TAKEN)
      assert.notEqual(error.code, 'E_SHORTLINK_SLUG_TAKEN')
    }
  })
})

test.group('ShortlinkService (integration, snake_case model)', (group) => {
  group.each.setup(setupDatabase)

  test('create with a generated slug', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())
    const link = await service.create('https://example.com/a')

    assert.equal(link.$getAttribute('original_url'), 'https://example.com/a')
    assert.equal(link.$getAttribute('domain'), 'short.example.com')
    assert.equal(link.$getAttribute('slug').length, 8)
    assert.equal(link.$getAttribute('clicks'), 0)
  })

  test('create with a custom slug throws E_SLUG_TAKEN on collision', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())
    await service.create('https://example.com/a', { slug: 'taken' })

    try {
      await service.create('https://example.com/b', { slug: 'taken' })
      assert.fail('expected create to throw')
    } catch (error) {
      assert.equal(error.code, 'E_SHORTLINK_SLUG_TAKEN')
    }
  })

  test('findBySlug resolves through the mapped attribute names', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())
    await service.create('https://example.com/a', { slug: 'scoped' })

    const found = await service.findBySlug('scoped')
    assert.isNotNull(found)
    assert.equal(found!.$getAttribute('original_url'), 'https://example.com/a')
  })

  test('findByUrl / firstOrCreate is idempotent', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())

    const first = await service.firstOrCreate('https://example.com/a')
    const second = await service.firstOrCreate('https://example.com/a')
    const found = await service.findByUrl('https://example.com/a')

    assert.equal(first.id, second.id)
    assert.equal(found!.id, first.id)
  })

  test('update changes the original URL, slug and metadata', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())
    const link = await service.create('https://example.com/a', { slug: 'old-slug' })

    const updated = await service.update(link, {
      originalUrl: 'https://example.com/b',
      slug: 'new-slug',
      metadata: { campaign: 'summer' },
    })

    assert.equal(updated.$getAttribute('original_url'), 'https://example.com/b')
    assert.equal(updated.$getAttribute('slug'), 'new-slug')
    assert.deepEqual(updated.$getAttribute('metadata'), { campaign: 'summer' })
  })

  test('recordClick increments the clicks column', async ({ assert }) => {
    const service = new ShortlinkService(makeSnakeConfig())
    const link = await service.create('https://example.com/a')

    await service.recordClick(link)
    await service.recordClick(link.id, 2)

    const reloaded = await service.find(link.id)
    assert.equal(reloaded!.$getAttribute('clicks'), 3)
  })
})
