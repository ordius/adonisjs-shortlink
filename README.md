![@mixxtor/adonisjs-shortlink](https://socialify.git.ci/mixxtor/adonisjs-shortlink/image?description=1&descriptionEditable=URL%20shortener%20service%20for%20AdonisJS%20v6.&font=Jost&forks=1&issues=1&logo=https://raw.githubusercontent.com/mixxtor/adonisjs-shortlink/1277869dc1a89bac3ef9764d42637b5b81103daf/logo.svg&name=1&owner=1&pattern=Charlie%20Brown&pulls=1&stargazers=1&theme=Auto)

# @mixxtor/adonisjs-shortlink

[![npm version](https://badge.fury.io/js/@mixxtor%2Fadonisjs-shortlink.svg)](https://www.npmjs.com/package/@mixxtor/adonisjs-shortlink)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.6.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![AdonisJS](https://img.shields.io/badge/AdonisJS-6.x-purple)

A powerful, type-safe URL shortener service for AdonisJS v7 with configurable models, advanced click tracking, and production-ready features.

## ✨ Features

- 🎯 **Configurable Models** - Use your own custom models or extend the provided base model
- 🔒 **Full Type Safety** - Complete TypeScript support with proper contracts and interfaces
- 📊 **Advanced Click Tracking** - Monitor usage with detailed analytics support
- 🎛️ **Flexible Configuration** - Customize domains, URL prefixes, protocols, and behavior
- 🔧 **Auto Setup** - One command installation with automated stub generation
- 🔗 **Custom Slugs** - Support for both auto-generated and custom slugs
- 🗄️ **Database Agnostic** - Works with any Lucid-supported database
- 📱 **Framework Integration** - Deep AdonisJS integration with IoC container support

## 📦 Installation

Install the package via npm:

```bash
npm install @mixxtor/adonisjs-shortlink
```

### 🚀 Quick Setup (Recommended)

The package includes an automated setup command that handles everything for you:

```bash
node ace configure @mixxtor/adonisjs-shortlink
```

This command will automatically:

- ✅ Create the configuration file at `config/shortlink.ts`
- ✅ Generate the `Shortlink` model with proper typing
- ✅ Create and run the database migration
- ✅ Register the service provider in `adonisrc.ts`
- ✅ Setup environment variables template

### 🔧 Manual Setup (Advanced)

If you prefer manual setup or need custom configuration:

#### 1. Add Provider

Add the provider to your `adonisrc.ts`:

```typescript
{
  providers: [
    // ... other providers
    () => import('@mixxtor/adonisjs-shortlink/providers/shortlink_provider'),
  ]
}
```

#### 2. Create Configuration

Create `config/shortlink.ts` with configurable model support:

```typescript
import env from '#start/env'
import { defineConfig } from '@mixxtor/adonisjs-shortlink'
import Shortlink from '#models/shortlink'

const shortlinkConfig = defineConfig({
  model: () => Shortlink, // 🎯 Configurable model
  enabled: true,
  domain: env.get('SHORTLINK_DOMAIN'),
  protocol: env.get('SHORTLINK_PROTOCOL', 'https'),
  prefix: env.get('SHORTLINK_PREFIX', 's'),
  slugLength: env.get('SHORTLINK_SLUG_LENGTH', 8),
  trackClicks: env.get('SHORTLINK_TRACK_CLICKS', true),
  redirectStatusCode: env.get('SHORTLINK_REDIRECT_STATUS_CODE', 301),
  connection: 'pg',
  tableName: 'shortlinks',
})

export default shortlinkConfig
```

#### 3. Environment Setup

Add to your `.env` file:

```env
# Required
SHORTLINK_DOMAIN=short.yourdomain.com

# Optional (with defaults)
SHORTLINK_PROTOCOL=https
SHORTLINK_SLUG_LENGTH=8
SHORTLINK_TRACK_CLICKS=true
SHORTLINK_REDIRECT_STATUS_CODE=301
SHORTLINK_PREFIX=s
```

#### 4. Create Model

Create `app/models/shortlink.ts` that implements the model attributes:

```typescript
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Shortlink extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column({ columnName: 'original_url' })
  declare original_url: string

  @column()
  declare clicks: number

  @column()
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updated_at: DateTime

  /**
   * Optional: Custom method to increment clicks
   */
  async incrementClicks(): Promise<void> {
    this.clicks = (this.clicks || 0) + 1
    await this.save()
  }
}
```

#### 5. Create Migration

Create migration `database/migrations/TIMESTAMP_create_shortlinks_table.ts`:

```bash
node ace make:migration create_shortlinks_table
```

Migration content:

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shortlinks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('slug', 255).notNullable().unique().index()
      table.text('original_url').notNullable()
      table.integer('clicks').defaultTo(0).notNullable()
      table.jsonb('metadata').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

#### 6. Run Migration

```bash
node ace migration:run
```

## 📖 Usage

### Type-Safe Service Usage

The service can be used in multiple ways depending on your needs:

#### Option 1: Direct Service Instantiation (Recommended)

```typescript
import shortlinkService from '@mixxtor/adonisjs-shortlink/services/main'
import { shortlinkConfig } from '#config/shortlink'

export default class SomeController {
  async someMethod() {
    // Create a shortlink with optional custom slug and metadata
    const shortlink = await shortlinkService.create('https://example.com/very-long-url', {
      slug: 'custom-slug', // Optional
      metadata: { campaign: 'summer-2024' }, // Optional
    })
  }
}
```

#### Option 2: IoC Container (Advanced)

```typescript
import type { ShortlinkServiceContract } from '@mixxtor/adonisjs-shortlink/types'
import type { HttpContext } from '@adonisjs/core/http'

export default class SomeController {
  async someMethod({ app }: HttpContext) {
    const shortlinkService = (await app.container.make('shortlink')) as ShortlinkServiceContract

    const shortlink = await shortlinkService.create('https://example.com/very-long-url', {
      slug: 'custom-slug',
      metadata: { campaign: 'summer-2024' },
    })
  }
}
```

### 🔗 Creating Shortlinks

```typescript
import shortlinkService from '@mixxtor/adonisjs-shortlink/services/main'
import { shortlinkConfig } from '#config/shortlink'

// Basic shortlink creation
const shortlink = await shortlinkService.create('https://example.com/very/long/url')
console.log(shortlinkService.getShortUrl(shortlink.slug))
// Output: https://short.yourdomain.com/s/aBcD1234

// With custom slug
const customShortlink = await shortlinkService.create('https://example.com/sale', {
  slug: 'summer-sale',
})
// Output: https://short.yourdomain.com/s/summer-sale

// With metadata for tracking
const trackedShortlink = await shortlinkService.create('https://example.com/product', {
  slug: 'bf-sale',
  metadata: { campaign: 'Black Friday', source: 'email' },
})

// Avoid duplicates - returns existing if URL already shortened
const existing = await shortlinkService.getOrCreate('https://example.com/url')
```

### 🚀 Controller Integration

Create a dedicated controller `app/controllers/shortlinks_controller.ts`:

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import shortlinkService from '@mixxtor/adonisjs-shortlink/services/main'
import shortlinkConfig from '#config/shortlink'

export default class ShortlinksController {
  /**
   * Create a new shortlink
   */
  async create({ request, response }: HttpContext) {
    const { original_url, custom_slug, metadata } = request.only([
      'original_url',
      'custom_slug',
      'metadata',
    ])

    if (!original_url) {
      return response.badRequest({
        success: false,
        message: 'original_url is required',
      })
    }

    try {
      const shortlink = await this.shortlinkService.create(original_url, {
        slug: custom_slug,
        metadata,
      })

      return response.created({
        success: true,
        data: {
          id: shortlink.id,
          slug: shortlink.slug,
          original_url: shortlink.original_url,
          short_url: this.shortlinkService.getShortUrl(shortlink.slug),
          clicks: shortlink.clicks,
          created_at: shortlink.created_at,
          metadata: shortlink.metadata,
        },
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Redirect to original URL and track click
   */
  async redirect({ params, response }: HttpContext) {
    const { slug } = params

    const shortlink = await this.shortlinkService.getBySlug(slug)

    if (!shortlink) {
      return response.notFound({
        error: 'Shortlink not found',
        message: `The shortlink "${slug}" does not exist`,
      })
    }

    // Click tracking is handled automatically by the service if enabled in config
    return response.redirect(shortlink.original_url, true, 301)
  }

  /**
   * Get shortlink statistics
   */
  async show({ params, response }: HttpContext) {
    const { slug } = params

    const shortlink = await this.shortlinkService.getBySlug(slug)

    if (!shortlink) {
      return response.notFound({
        error: 'Shortlink not found',
        message: `The shortlink "${slug}" does not exist`,
      })
    }

    return response.json({
      slug: shortlink.slug,
      original_url: shortlink.original_url,
      short_url: this.shortlinkService.getShortUrl(shortlink.slug),
      clicks: shortlink.clicks,
      created_at: shortlink.created_at,
      updated_at: shortlink.updated_at,
      metadata: shortlink.metadata,
    })
  }
}
```

### 🛣️ Routes Setup

When you run `node ace add @mixxtor/adonisjs-shortlink`, the package will automatically:

1. **Generate route files** for you to include in your application
2. **Choose controller type**: Use the built-in package controller or generate a custom one

**Include the generated routes in your `start/routes.ts`:**

```typescript
import './shortlinks.js' // Include generated shortlink routes
```

The generated routes file includes:

```typescript
// Generated start/routes/shortlinks.ts
import router from '@adonisjs/core/services/router'
const ShortlinkController = () => import('#controllers/shortlink_controller')

// Main redirect route
router.get('/:slug', [ShortlinkController, 'redirect']).as('shortlink.redirect')

// Optional API endpoints (uncomment if needed)
router.get('/api/shortlinks/:slug', [ShortlinkController, 'show']).as('shortlink.show')
router.post('/api/shortlinks', [ShortlinkController, 'store']).as('shortlink.store')
router.delete('/api/shortlinks/:slug', [ShortlinkController, 'destroy']).as('shortlink.destroy')
```

#### Production Setup with Custom Domain

For production, use a separate short domain for redirects:

```typescript
// Only redirect functionality on short domain (short.yourdomain.com)
router.get('/:slug', [ShortlinkController, 'redirect']).domain('short.yourdomain.com')

// Main domain routes (yourdomain.com)
router
  .group(() => {
    router.post('/api/shortlinks', [ShortlinkController, 'store'])
    router.get('/api/shortlinks/:slug', [ShortlinkController, 'show'])
    router.delete('/api/shortlinks/:slug', [ShortlinkController, 'destroy'])
  })
  .middleware('auth') // Add authentication as needed
```

## ⚙️ Configuration Options

### Available Configuration Properties

```typescript
import env from '#start/env'
import { defineConfig } from '@mixxtor/adonisjs-shortlink'
import Shortlink from '#models/shortlink'

const shortlinkConfig = defineConfig({
  /**
   * 🎯 Model Configuration
   * Specify which model to use - allows for complete customization
   */
  model: () => Shortlink, // Required: Lucid model for shortlinks

  /**
   * 🌐 Service Settings
   */
  enabled: true, // Enable/disable the shortlink service
  domain: env.get('SHORTLINK_DOMAIN'), // Required: Short domain (e.g., 'short.domain.com')
  protocol: env.get('SHORTLINK_PROTOCOL', 'https'), // 'http' | 'https'
  prefix: env.get('SHORTLINK_PREFIX', 's'), // URL prefix for shortlinks (e.g., 's' -> domain.com/s/slug)

  /**
   * 🔗 Slug Generation
   */
  slugLength: env.get('SHORTLINK_SLUG_LENGTH', 8), // Length for auto-generated slugs

  /**
   * 📊 Analytics & Tracking
   */
  trackClicks: env.get('SHORTLINK_TRACK_CLICKS', true), // Enable/disable click tracking

  /**
   * 🚀 Redirect Behavior
   */
  redirectStatusCode: env.get('SHORTLINK_REDIRECT_STATUS_CODE', 301), // 301 (permanent) | 302 (temporary)

  /**
   * 🗄️ Database Settings
   */
  connection: 'pg', // Database connection name
  tableName: 'shortlinks', // Table name for shortlinks
})

export default shortlinkConfig
```

### 🔧 Custom Model Implementation

You can extend the basic model with additional fields and relationships:

```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'

export default class CustomShortlink extends BaseModel {
  // Required fields (matching ShortlinkAttributes interface)
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column({ columnName: 'original_url' })
  declare original_url: string

  @column()
  declare clicks: number

  @column()
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updated_at: DateTime

  // 🎯 Add your own custom fields!
  @column({ columnName: 'user_id' })
  declare user_id: number | null

  @column()
  declare title: string | null

  @column()
  declare description: string | null

  @column.dateTime({ columnName: 'expires_at' })
  declare expires_at: DateTime | null

  @column({ columnName: 'is_active' })
  declare is_active: boolean

  // Custom relationships
  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: BelongsTo<typeof User>

  // Custom methods
  get isExpired() {
    return this.expires_at && this.expires_at < DateTime.now()
  }

  async incrementClicks(): Promise<void> {
    this.clicks = (this.clicks || 0) + 1
    await this.save()
  }
}
```

## 📚 API Reference

### ShortlinkService Methods

The service provides a clean, type-safe API:

```typescript
interface ShortlinkServiceContract<Model extends ShortlinkModel = ShortlinkModel> {
  // Core Methods
  create(
    originalUrl: string,
    data?: Partial<Pick<Model, 'slug' | 'metadata'>>
  ): Promise<ShortlinkModelContract<Model>>

  getBySlug(slug: string): Promise<ShortlinkModelContract<Model> | null>

  getByOriginalUrl(originalUrl: string): Promise<ShortlinkModelContract<Model> | null>

  getOrCreate(
    originalUrl: string,
    data?: Partial<Pick<Model, 'slug' | 'metadata'>>
  ): Promise<ShortlinkModelContract<Model>>

  // Management Methods
  getById(id: number): Promise<ShortlinkModelContract<Model> | null>
  delete(id: number): Promise<boolean>
  deleteBySlug(slug: string): Promise<boolean>
  updateOrCreate(
    idOrOriginalUrl: number | string,
    data: Pick<Model, 'original_url'> & Partial<Pick<Model, 'slug' | 'metadata'>>
  ): Promise<ShortlinkModelContract<Model> | null>

  // Utilities
  getShortUrl(slug: string): string | undefined
  getSlugFromShortUrl(shortUrl: string | undefined): string | undefined
  getBaseUrl(): string
}
```

### Configuration Interface

```typescript
interface ShortlinkConfig<Model extends LucidModel = LucidModel> {
  model: () => Promise<{ default: Model }> | Model
  enabled: boolean
  domain: string
  protocol?: 'http' | 'https'
  prefix?: string
  slugLength: number
  trackClicks: boolean
  redirectStatusCode: 301 | 302
  connection?: string
  tableName?: string
}
```

### Model Attributes Interface

```typescript
interface ShortlinkAttributes {
  id: number
  slug: string
  original_url: string
  clicks: number
  metadata: Record<string, any> | null
  created_at: DateTime
  updated_at: DateTime
}

// Type that your model should extend
type ShortlinkModel = LucidModel &
  ShortlinkAttributes & {
    incrementClicks?(): Promise<void>
    delete(): Promise<void>
  }
```

## 🧪 Testing

The package includes comprehensive tests. Run them with:

```bash
npm test
```

### Testing Your Implementation

```typescript
import { test } from '@japa/runner'
import { createShortlinkService } from '@mixxtor/adonisjs-shortlink/services/main'
import { shortlinkConfig } from '#config/shortlink'

test.group('Shortlink Service', () => {
  test('creates shortlink successfully', async ({ assert }) => {
    const shortlinkService = await createShortlinkService(shortlinkConfig)
    const shortlink = await shortlinkService.create('https://example.com')

    assert.exists(shortlink.slug)
    assert.equal(shortlink.original_url, 'https://example.com')
    assert.equal(shortlink.clicks, 0)
  })

  test('prevents duplicate slugs', async ({ assert }) => {
    const shortlinkService = await createShortlinkService(shortlinkConfig)
    await shortlinkService.create('https://example.com', { slug: 'test' })

    await assert.rejects(
      () => shortlinkService.create('https://other.com', { slug: 'test' }),
      'Slug "test" is already taken'
    )
  })

  test('creates shortlink with metadata', async ({ assert }) => {
    const shortlinkService = await createShortlinkService(shortlinkConfig)
    const metadata = { campaign: 'test', source: 'api' }
    const shortlink = await shortlinkService.create('https://example.com', {
      slug: 'test-meta',
      metadata,
    })

    assert.equal(shortlink.slug, 'test-meta')
    assert.deepEqual(shortlink.metadata, metadata)
  })

  test('getOrCreate returns existing shortlink', async ({ assert }) => {
    const shortlinkService = await createShortlinkService(shortlinkConfig)
    const originalUrl = 'https://example.com/unique'

    const first = await shortlinkService.create(originalUrl)
    const second = await shortlinkService.getOrCreate(originalUrl)

    assert.equal(first.id, second.id)
    assert.equal(first.slug, second.slug)
  })
})
```

## 🚀 Production Deployment

### Domain Configuration

For production, set up your short domain:

1. **DNS Configuration**: Point your short domain to your application
2. **SSL Certificate**: Ensure HTTPS is configured
3. **Environment Variables**: Set `SHORTLINK_DOMAIN` and `SHORTLINK_PROTOCOL`

### Multi-Domain Setup

**Option 1: Same Application**

```typescript
// In your main application, handle both domains

const ShortlinkController = () => import('#controllers/shortlink_controller')

// Only serve redirect routes on short domain
router
  .group(() => {
    router.get('/:slug', [ShortlinkController, 'redirect'])
  })
  .domain('short.yourdomain.com')

// Serve full API and management routes on main domain
router
  .group(() => {
    router.post('/shortlinks', [ShortlinkController, 'create'])
    router.get('/shortlinks/:slug', [ShortlinkController, 'show'])
  })
  .prefix('/api')
```

**Option 2: Separate Applications**

- Main app handles shortlink creation API
- Separate minimal app on short domain handles redirects only

### Performance Optimization

1. **Database Indexing**:

```sql
CREATE INDEX CONCURRENTLY idx_shortlinks_slug ON shortlinks(slug);
CREATE INDEX CONCURRENTLY idx_shortlinks_original_url ON shortlinks(original_url);
```

2. **Caching**: Use `@adonisjs/cache` (install separately) to cache shortlinks:

```typescript
import cache from '@adonisjs/cache/services/main'
import shortlinkService from '@mixxtor/adonisjs-shortlink/services/main'

// Cache shortlink after creation
const shortlink = await shortlinkService.create('https://example.com')
await cache.set(`shortlink:${shortlink.slug}`, shortlink, '1h')

// Use cache in redirect route for better performance
async redirect({ params, response }: HttpContext) {
  const { slug } = params

  const shortlink = await cache.getOrSet<typeof shortlink>({
    key: `shortlink:${slug}`,
    factory: () => shortlinkService.getBySlug(slug),
  })

  if (!shortlink) {
    return response.notFound('Shortlink not found')
  }

  return response.redirect(shortlink.original_url, true, 301)
}
```

3. **Database Connection Pooling**: Configure your database for high concurrent reads

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- 📚 [Documentation](https://github.com/mixxtor/adonisjs-shortlink)
- 🐛 [Issues](https://github.com/mixxtor/adonisjs-shortlink/issues)

<!-- - 💬 [Discussions](https://github.com/mixxtor/adonisjs-shortlink/discussions) -->

---

Built with ❤️ for the AdonisJS community
