import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(process.env.MEDIA_ROOT ?? '/Volumes/MyPassport/Photos/hidden');
const port = Number(process.env.PORT ?? 8787);
const cacheRoot = resolve(process.env.THUMBNAIL_CACHE ?? join(process.cwd(), '.server-cache', 'thumbnails'));
const catalogPath = join(dirname(cacheRoot), 'catalog.json');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif']);
const videoExtensions = new Set(['.mov', '.mp4', '.m4v']);
const supportedExtensions = new Set([...imageExtensions, ...videoExtensions]);
const thumbnails = new Map();
let assets = [];
let scanError = null;
let scanning = null;
const pendingItems = new Map();
const pendingRemovedPaths = new Set();

function json(response, status, value) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(value));
}

function mediaPath(relativePath) {
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) throw new Error('Invalid media path');
  return candidate;
}

async function walk(directory, entries) {
  const children = await readdir(directory, { withFileTypes: true });
  for (const child of children) {
    if (child.name.startsWith('.')) continue;
    const path = join(directory, child.name);
    if (child.isDirectory()) {
      if (directory === root && child.name.toLowerCase() === 'pmv') continue;
      await walk(path, entries);
      continue;
    }
    if (!child.isFile()) continue;
    const extension = extname(child.name).toLowerCase();
    if (!supportedExtensions.has(extension)) continue;
    const details = await stat(path);
    entries.push({
      path: relative(root, path),
      filename: child.name,
      mediaKind: videoExtensions.has(extension) ? 'video' : 'image',
      modifiedAt: details.mtimeMs,
      fileSize: details.size,
      width: null,
      height: null,
      duration: null,
    });
  }
}

async function scan() {
  if (scanning) return scanning;
  scanning = (async () => {
    const entries = [];
    try {
      await walk(root, entries);
      entries.sort((left, right) => right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path));
      const previous = new Map(assets.map((asset) => [asset.path, asset]));
      const currentPaths = new Set(entries.map((asset) => asset.path));
      for (const entry of entries) {
        const old = previous.get(entry.path);
        if (
          !old ||
          old.modifiedAt !== entry.modifiedAt ||
          old.fileSize !== entry.fileSize ||
          old.mediaKind !== entry.mediaKind
        ) {
          pendingItems.set(entry.path, entry);
          pendingRemovedPaths.delete(entry.path);
        }
      }
      for (const old of assets) {
        if (!currentPaths.has(old.path)) {
          pendingItems.delete(old.path);
          pendingRemovedPaths.add(old.path);
        }
      }
      assets = entries;
      await mkdir(dirname(catalogPath), { recursive: true });
      const temporaryCatalog = `${catalogPath}.${process.pid}.tmp`;
      await writeFile(temporaryCatalog, JSON.stringify(assets));
      await rename(temporaryCatalog, catalogPath);
      scanError = null;
      return assets.length;
    } catch (error) {
      scanError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      scanning = null;
    }
  })();
  return scanning;
}

async function loadCatalog() {
  try {
    const value = JSON.parse(await readFile(catalogPath, 'utf8'));
    if (Array.isArray(value)) assets = value;
  } catch {}
}

function clearPendingChanges() {
  pendingItems.clear();
  pendingRemovedPaths.clear();
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(errorOutput.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function thumbnail(relativePath) {
  const source = mediaPath(relativePath);
  const key = createHash('sha256').update(relativePath).digest('hex');
  const output = join(cacheRoot, `${key}.jpg`);
  try {
    await stat(output);
    return output;
  } catch {}

  if (!thumbnails.has(output)) {
    thumbnails.set(output, (async () => {
      await mkdir(cacheRoot, { recursive: true });
      const temporary = `${output}.${process.pid}.tmp.jpg`;
      const extension = extname(source).toLowerCase();
      if (videoExtensions.has(extension)) {
        await run('/usr/local/bin/ffmpeg', [
          '-y', '-ss', '1', '-i', source, '-frames:v', '1',
          '-vf', "scale='min(640,iw)':-2", '-q:v', '4', temporary,
        ]);
      } else {
        await run('/usr/bin/sips', ['-s', 'format', 'jpeg', '-Z', '640', source, '--out', temporary]);
      }
      await rename(temporary, output);
      return output;
    })().finally(() => thumbnails.delete(output)));
  }
  return thumbnails.get(output);
}

async function streamFile(request, response, path, contentType, cacheControl = 'private, max-age=3600') {
  const details = await stat(path);
  const range = request.headers.range;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('Content-Type', contentType);

  if (!range) {
    response.writeHead(200, { 'Content-Length': details.size });
    createReadStream(path).pipe(response);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    response.writeHead(416, { 'Content-Range': `bytes */${details.size}` });
    response.end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), details.size - 1) : details.size - 1;
  if (start > end || start >= details.size) {
    response.writeHead(416, { 'Content-Range': `bytes */${details.size}` });
    response.end();
    return;
  }
  response.writeHead(206, {
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${details.size}`,
  });
  createReadStream(path, { start, end }).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `localhost:${port}`}`);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
      });
      response.end();
      return;
    }
    if (url.pathname === '/health') {
      json(response, scanError ? 503 : 200, {
        status: scanning ? 'scanning' : scanError ? 'error' : 'ready',
        assets: assets.length,
        root,
        error: scanError,
      });
      return;
    }
    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      await scan();
      const items = [...pendingItems.values()];
      const removedPaths = [...pendingRemovedPaths];
      clearPendingChanges();
      json(response, 200, { assets: assets.length, items, removedPaths });
      return;
    }
    if (url.pathname === '/api/assets') {
      if (scanning) await scanning;
      if (scanError) throw new Error(scanError);
      const offset = Math.max(0, Number(url.searchParams.get('cursor') ?? 0) || 0);
      const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') ?? 250) || 250));
      const items = assets.slice(offset, offset + limit);
      const next = offset + items.length;
      if (next >= assets.length) clearPendingChanges();
      json(response, 200, {
        items,
        nextCursor: next < assets.length ? String(next) : null,
      });
      return;
    }
    if (url.pathname === '/thumbnail') {
      const path = await thumbnail(url.searchParams.get('path') ?? '');
      await streamFile(request, response, path, 'image/jpeg', 'public, max-age=604800');
      return;
    }
    if (url.pathname === '/media') {
      const path = mediaPath(url.searchParams.get('path') ?? '');
      const extension = extname(path).toLowerCase();
      const types = {
        '.heic': 'image/heic',
        '.heif': 'image/heif',
        '.jpeg': 'image/jpeg',
        '.jpg': 'image/jpeg',
        '.m4v': 'video/x-m4v',
        '.mov': 'video/quicktime',
        '.mp4': 'video/mp4',
        '.png': 'image/png',
      };
      await streamFile(request, response, path, types[extension] ?? 'application/octet-stream');
      return;
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

await loadCatalog();
server.listen(port, '0.0.0.0', () => {
  console.log(`Remote Library server: http://0.0.0.0:${port}`);
  console.log(`Media root: ${root}`);
  console.log(`Loaded ${assets.length.toLocaleString()} cached assets`);
});
void scan()
  .then((count) => console.log(`Indexed ${count.toLocaleString()} assets`))
  .catch((error) => console.error(`Initial scan failed: ${error instanceof Error ? error.message : String(error)}`));
