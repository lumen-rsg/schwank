import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const journalPath = resolve(repositoryRoot, 'drizzle/meta/_journal.json');
const outputPath = resolve(repositoryRoot, 'db/runtime-migrations.json');
const journal = JSON.parse(await readFile(journalPath, 'utf8'));
const migrations = [];

for (const entry of journal.entries) {
  const sqlPath = resolve(repositoryRoot, 'drizzle', `${entry.tag}.sql`);
  const source = await readFile(sqlPath, 'utf8');
  migrations.push({
    id: entry.tag,
    hash: createHash('sha256').update(source).digest('hex'),
    statements: source
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean),
  });
}

const output = `${JSON.stringify(migrations, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  let current = null;
  try {
    current = JSON.parse(existing);
  } catch {}
  if (JSON.stringify(current) !== JSON.stringify(migrations)) {
    console.error('Runtime migration bundle is stale. Run npm run db:bundle.');
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, output);
}
