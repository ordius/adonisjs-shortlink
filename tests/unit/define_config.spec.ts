import { test } from '@japa/runner'
import { configProvider } from '@adonisjs/core'
import { AppFactory } from '@adonisjs/core/factories/app'

import { defineConfig } from '../../src/define_config.js'
import type { ShortlinkModel } from '../../src/types.js'

const app = new AppFactory().create(new URL('./', import.meta.url), () => {})
const FakeModel = class {} as unknown as ShortlinkModel

test.group('defineConfig', () => {
  test('resolves with defaults applied', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
      domain: 'short.example.com',
    })

    const config = await configProvider.resolve(app, provider)

    assert.isNotNull(config)
    assert.equal(config!.model, FakeModel)
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
      model: async () => ({ default: FakeModel }),
      domain: 'https://short.example.com/',
    })

    const config = await configProvider.resolve(app, provider)
    assert.equal(config!.domain, 'short.example.com')
  })

  test('dedupes domains and keeps the primary one first', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
      domain: 'a.example.com',
      domains: ['b.example.com', 'a.example.com'],
    })

    const config = await configProvider.resolve(app, provider)
    assert.deepEqual(config!.domains, ['a.example.com', 'b.example.com'])
  })

  test('normalizes prefix to a leading slash without a trailing one', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
      domain: 'short.example.com',
      prefix: 's/',
    })

    const config = await configProvider.resolve(app, provider)
    assert.equal(config!.prefix, '/s')
  })

  test('lower-cases reserved slugs', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
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
    const provider = defineConfig({ model: async () => ({ default: FakeModel }) } as any)

    await assert.rejects(() => configProvider.resolve(app, provider), /Missing "domain"/)
  })

  test('throws when slug.length is below the minimum', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
      domain: 'short.example.com',
      slug: { length: 2 },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.length/)
  })

  test('throws when slug.alphabet has fewer than 2 unique characters', async ({ assert }) => {
    const provider = defineConfig({
      model: async () => ({ default: FakeModel }),
      domain: 'short.example.com',
      slug: { alphabet: 'aaaa' },
    })

    await assert.rejects(() => configProvider.resolve(app, provider), /slug\.alphabet/)
  })
})
