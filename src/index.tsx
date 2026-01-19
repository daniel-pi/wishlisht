import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getMimeType } from 'hono/utils/mime'
// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

const manifest = JSON.parse(manifestJSON)

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  __STATIC_CONTENT: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

// API: Get all items
app.get('/api/items', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM items ORDER BY priority ASC, created_at DESC`
  ).all()
  return c.json(results)
})

// API: Add new item
app.post('/api/items', async (c) => {
  const body = await c.req.json()
  const { name, price, url, image_key, category, priority } = body
  
  const result = await c.env.DB.prepare(
    `INSERT INTO items (name, price, url, image_key, category, priority) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, price, url, image_key, category || 'uncategorized', priority || 0).run()
  
  return c.json({ success: true, id: result.meta.last_row_id })
})

// API: Update item
app.put('/api/items/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, price, url, image_key, category, priority } = body
  
  // Build dynamic update query
  const updates: string[] = []
  const values: any[] = []

  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (price !== undefined) { updates.push('price = ?'); values.push(price) }
  if (url !== undefined) { updates.push('url = ?'); values.push(url) }
  if (image_key !== undefined) { updates.push('image_key = ?'); values.push(image_key) }
  if (category !== undefined) { updates.push('category = ?'); values.push(category) }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority) }

  if (updates.length === 0) return c.json({ success: true })

  values.push(id)
  await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  
  return c.json({ success: true })
})

// API: Delete item
app.delete('/api/items/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// API: Upload image to R2
app.put('/api/upload/:key', async (c) => {
  const key = c.req.param('key')
  const body = await c.req.arrayBuffer()
  
  await c.env.BUCKET.put(key, body, {
    httpMetadata: { contentType: c.req.header('content-type') || 'application/octet-stream' }
  })
  
  return c.json({ success: true, key })
})

// API: Serve image from R2
app.get('/image/:key', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.BUCKET.get(key)
  
  if (!object) {
    return c.text('Image not found', 404)
  }
  
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  
  return new Response(object.body, {
    headers,
  })
})

// Manual Static File Serving
app.get('*', async (c) => {
  let path = new URL(c.req.url).pathname
  if (path === '/') path = 'index.html'
  if (path.startsWith('/')) path = path.substring(1) // Strip leading slash

  const assetKey = manifest[path] || manifest['index.html'] // Fallback to SPA index.html

  if (!assetKey) {
    return c.text('Not Found', 404)
  }

  const content = await c.env.__STATIC_CONTENT.get(assetKey, { type: 'arrayBuffer' })
  if (!content) {
    return c.text('Asset Not Found', 404)
  }

  const mimeType = getMimeType(path) || 'text/html'
  return c.body(content, 200, { 'Content-Type': mimeType })
})

export default app

