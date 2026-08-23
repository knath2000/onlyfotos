import { listMediaPage } from '@/server/MediaServer';
import { finishScan, upsertEntries } from '@/storage/database';

const PAGE_SIZE = 250;

export async function scanLibrary(
  signal: AbortSignal,
  report: (discovered: number, indexed: number) => void,
) {
  const generation = Date.now();
  let cursor: string | null = null;
  let discovered = 0;

  do {
    if (signal.aborted) return false;
    const page = await listMediaPage(cursor, PAGE_SIZE);
    discovered += page.items.length;
    await upsertEntries(page.items, generation);
    report(discovered, discovered);
    cursor = page.nextCursor;
  } while (cursor);

  if (signal.aborted) return false;
  await finishScan(generation);
  return true;
}
