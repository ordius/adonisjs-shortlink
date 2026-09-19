import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import { AppFactory } from '@adonisjs/core/factories/app'
import { BaseModel, column } from '@adonisjs/lucid/orm'

import { defineConfig } from '../../src/define_config.js'

const app = new AppFactory().create(new URL('./', import.meta.url), () => {})

/**
 * A real Lucid model (column registration/`boot()` happen synchronously via
 * decorators, no live database connection needed) exposing every column
 * `defineConfig` depends on, so attribute resolution is exercised for real
 * instead of being assumed.
 */
class FullShortlink extends BaseModel {
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

  @column()
  declare metadata: Record<string, unknown> | null
}

/**
 * Same contract, minus the optional `metadata` column.
 */
class ShortlinkWithoutMetadata extends BaseModel {
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
}

/**
 * Missing the `clicks` column entirely — used to prove a model that can't
 * satisfy the table-column contract is rejected at resolve time.
 */
class ShortlinkMissingClicks extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare domain: string

  @column()
  declare slug: string

  @column()
  declare originalUrl: string
}

test.group('defineConfig', () => {
  test('resolves with defaults applied', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
    })

    const config = await configProvider.resolve(app, provider)

    assert.isNotNull(config)
    assert.equal(config!.model, FullShortlink)
    assert.equal(config!.domain, 'short.example.com')
    assert.deepEqual(config!.domains, ['short.example.com'])
    assert.equal(config!.protocol, 'https')
    assert.equal(config!.prefix, '')
    assert.equal(config!.redirectStatusCode, 302)
    assert.isTrue(config!.trackClicks)
    assert.equal(config!.slug.length, 8)
    assert.equal(config!.slug.maxAttempts, 5)
    assert.isEmpty([...config!.slug.reserved])
    assert.deepEqual(config!.allowedProtocols, ['http:', 'https:'])
  })

  test('normalizes a full URL domain down to a hostname', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'https://short.example.com/',
    })

    const config = await configProvider.resolve(app, provider)
    assert.equal(config!.domain, 'short.example.com')
  })

  test('drops the port from a configured domain', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'localhost:3333',
    })

    const config = await configProvider.resolve(app, provider)
    assert.equal(config!.domain, 'localhost')
  })

  test('throws when the domain has no hostname (e.g. a "file:" URL)', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'file:///tmp',
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /not a valid hostname/)
  })

  test('dedupes domains and keeps the primary one first', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'a.example.com',
      domains: ['b.example.com', 'a.example.com'],
    })

    const config = await configProvider.resolve(app, provider)
    assert.deepEqual(config!.domains, ['a.example.com', 'b.example.com'])
  })

  test('normalizes prefix to a leading slash without a trailing one', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      prefix: 's/',
    })

    const config = await configProvider.resolve(app, provider)
    assert.equal(config!.prefix, '/s')
  })

  test('lower-cases reserved slugs', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      slug: { reserved: ['API', 'Admin'] },
    })

    const config = await configProvider.resolve(app, provider)
    assert.isTrue(config!.slug.reserved.has('api'))
    assert.isTrue(config!.slug.reserved.has('admin'))
  })

  test('throws when model is missing', async ({ assert }) => {
    const provider = defineConfig({ domain: 'short.example.com' } as any)

    await assert.rejects(() => configProvider.resolve(app, provider), /Missing "model"/)
  })

  test('throws when domain is missing', async ({ assert }) => {
    const provider = defineConfig({ model: async () => ({ default: FullShortlink }) } as any)

    await assert.rejects(() => configProvider.resolve(app, provider), /Missing "domain"/)
  })

  test('throws when slug.length is below the minimum', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      slug: { length: 2 },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.length/)
  })

  test('throws when slug.alphabet has fewer than 2 unique characters', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      slug: { alphabet: 'aaaa' },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.alphabet/)
  })

  test('throws when slug.pattern uses the "g" flag', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      slug: { pattern: /^[a-z]+$/g },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.pattern/)
  })

  test('throws when slug.pattern uses the "y" flag', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
      slug: { pattern: /^[a-z]+$/y },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.pattern/)
  })

  test('resolves attribute names from a camelCase model', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FullShortlink }),
      domain: 'short.example.com',
    })

    const config = await configProvider.resolve(app, provider)
    assert.deepEqual(config!.attributes, {
      domain: 'domain',
      slug: 'slug',
      originalUrl: 'originalUrl',
      clicks: 'clicks',
      metadata: 'metadata',
    })
  })

  test('leaves "metadata" out of the attribute map when the model has no such column', async ({
    assert,
  }) => {
    const provider = defineConfig({
      model: async () => ({ default: ShortlinkWithoutMetadata }),
      domain: 'short.example.com',
    })

    const config = await configProvider.resolve(app, provider)
    assert.deepEqual(config!.attributes, {
      domain: 'domain',
      slug: 'slug',
      originalUrl: 'originalUrl',
      clicks: 'clicks',
    })
  })

  test('throws when the model is missing a required column', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: ShortlinkMissingClicks }),
      domain: 'short.example.com',
    })

    await assert.rejects(
      () => configProvider.resolve(app, provider),
      /ShortlinkMissingClicks.*"clicks"/
    )
  })
})
