import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import { AppFactory } from '@adonisjs/core/factories/app'

/**
 * Renders every published stub into a fresh temp app (via `@japa/file-system`)
 * the same way `configure()` would, and asserts each one actually lands on
 * disk at its expected path.
 *
 * This exists because of a real regression: the controller stub generated
 * `shortlink_controller.ts` (singular) while the routes stub imports
 * `#controllers/shortlinks_controller` (plural) — a silent 404 for anyone
 * who ran `node ace add`. Cross-checking the generated controller's
 * filename against the routes file's import is the regression test for it.
 */
const stubsRoot = fileURLToPath(new URL('../../stubs/', import.meta.url))

test.group('published stubs', () => {
  test('config/shortlink.stub publishes to config/shortlink.ts', async ({ assert, fs }) => {
    const app = new AppFactory().create(fs.baseUrl, () => {})
    await app.init()

    const manager = await app.stubs.create()
    const stub = await manager.build('config/shortlink.stub', { source: stubsRoot })
    const output = await stub.generate({ fileName: 'shortlink.ts' })

    assert.equal(output.status, 'created')
    await assert.fileExists(app.relativePath(output.destination))
    assert.equal(app.relativePath(output.destination), 'config/shortlink.ts')
  })

  test('models/shortlink.stub publishes to app/models/shortlink.ts', async ({ assert, fs }) => {
    const app = new AppFactory().create(fs.baseUrl, () => {})
    await app.init()

    const manager = await app.stubs.create()
    const stub = await manager.build('models/shortlink.stub', { source: stubsRoot })
    const output = await stub.generate({ fileName: 'shortlink.ts' })

    assert.equal(output.status, 'created')
    await assert.fileExists(app.relativePath(output.destination))
    assert.equal(app.relativePath(output.destination), 'app/models/shortlink.ts')
  })

  test('migrations/create_shortlinks_table.stub publishes under database/migrations', async ({
    assert,
    fs,
  }) => {
    const app = new AppFactory().create(fs.baseUrl, () => {})
    await app.init()

    const migrationFileName = `${Date.now()}_create_shortlinks_table.ts`
    const manager = await app.stubs.create()
    const stub = await manager.build('migrations/create_shortlinks_table.stub', {
      source: stubsRoot,
    })
    const output = await stub.generate({
      migration: { folder: 'database/migrations', fileName: migrationFileName },
    })

    assert.equal(output.status, 'created')
    await assert.fileExists(app.relativePath(output.destination))
    assert.equal(app.relativePath(output.destination), `database/migrations/${migrationFileName}`)
  })

  test('start/shortlinks.stub publishes to start/shortlinks.ts', async ({ assert, fs }) => {
    const app = new AppFactory().create(fs.baseUrl, () => {})
    await app.init()

    const manager = await app.stubs.create()
    const stub = await manager.build('start/shortlinks.stub', { source: stubsRoot })
    const output = await stub.generate({ fileName: 'shortlinks.ts' })

    assert.equal(output.status, 'created')
    await assert.fileExists(app.relativePath(output.destination))
    assert.equal(app.relativePath(output.destination), 'start/shortlinks.ts')
  })

  test("the generated controller filename matches the routes file's import", async ({
    assert,
    fs,
  }) => {
    const app = new AppFactory().create(fs.baseUrl, () => {})
    await app.init()

    const manager = await app.stubs.create()

    const controllerStub = await manager.build('controllers/shortlinks_controller.stub', {
      source: stubsRoot,
    })
    const controllerOutput = await controllerStub.generate({})

    assert.equal(controllerOutput.status, 'created')
    await assert.fileExists(app.relativePath(controllerOutput.destination))

    const controllerBaseName = basename(controllerOutput.destination, '.ts')
    // The regression: this used to be "shortlink_controller" (singular).
    assert.equal(controllerBaseName, 'shortlinks_controller')

    const routesStub = await manager.build('start/shortlinks.stub', { source: stubsRoot })
    const routesOutput = await routesStub.generate({ fileName: 'shortlinks.ts' })

    assert.equal(routesOutput.status, 'created')
    assert.include(routesOutput.contents, `#controllers/${controllerBaseName}`)
  })
})
