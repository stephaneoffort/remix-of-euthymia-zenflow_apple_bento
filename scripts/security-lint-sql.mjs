#!/usr/bin/env node
/**
 * Analyse statique des migrations SQL — garde-fou CI.
 *
 * Détecte les régressions de sécurité les plus courantes introduites par une
 * migration :
 *  1. CREATE TABLE dans public sans GRANT dans la même migration
 *  2. CREATE TABLE dans public sans ENABLE ROW LEVEL SECURITY
 *  3. Policy avec USING (true) / WITH CHECK (true)
 *  4. Policy sans clause TO (donc applicable au rôle public/anon)
 *  5. Policy UPDATE sans WITH CHECK (permet de réattribuer une ligne)
 *  6. Policy INSERT sans WITH CHECK
 *  7. GRANT ... TO anon sur une table
 *
 * Usage:
 *   node scripts/security-lint-sql.mjs [--all] [chemin...]
 * Par défaut, seules les migrations modifiées par rapport à origin/main sont
 * analysées ; --all force l'analyse de tout le dossier supabase/migrations.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const BASE_REF = process.env.SECURITY_LINT_BASE_REF || 'origin/main';

const argv = process.argv.slice(2);
const scanAll = argv.includes('--all');
const explicitFiles = argv.filter((a) => !a.startsWith('--'));

function listChangedMigrations() {
  try {
    const out = execSync(`git diff --name-only --diff-filter=ACMR ${BASE_REF}...HEAD`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith(MIGRATIONS_DIR) && l.endsWith('.sql') && existsSync(l));
  } catch {
    return null;
  }
}

function listAllMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

let files;
if (explicitFiles.length) {
  files = explicitFiles;
} else if (scanAll) {
  files = listAllMigrations();
} else {
  files = listChangedMigrations() ?? listAllMigrations();
}

if (!files.length) {
  console.log('✅ Aucune migration à analyser.');
  process.exit(0);
}

/** Supprime les commentaires SQL pour éviter les faux positifs. */
function strip(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Découpe grossièrement en instructions (les $$ ... $$ sont préservés). */
function statements(sql) {
  const out = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql.startsWith('$$', i)) {
      inDollar = !inDollar;
      buf += '$$';
      i++;
      continue;
    }
    const ch = sql[i];
    if (ch === ';' && !inDollar) {
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

const findings = [];
function report(level, file, rule, message) {
  findings.push({ level, file, rule, message });
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const sql = strip(raw);
  const stmts = statements(sql);

  const createdTables = [];
  const grantedTables = new Set();
  const rlsEnabled = new Set();

  for (const stmt of stmts) {
    const s = stmt.replace(/\s+/g, ' ').trim();
    const lower = s.toLowerCase();

    // --- CREATE TABLE ---
    const create = lower.match(/^create table (?:if not exists )?(?:public\.)?"?([a-z0-9_]+)"?/);
    if (create) createdTables.push(create[1]);

    // --- GRANT ---
    const grant = lower.match(/^grant .*? on (?:table )?(?:public\.)?"?([a-z0-9_]+)"?/);
    if (grant) {
      grantedTables.add(grant[1]);
      if (/\bto\b[^;]*\banon\b/.test(lower)) {
        report(
          'warn',
          file,
          'grant-anon',
          `GRANT vers le rôle anon sur "${grant[1]}" — à confirmer : la table est-elle réellement publique ?`,
        );
      }
    }

    // --- ENABLE RLS ---
    const rls = lower.match(/^alter table (?:public\.)?"?([a-z0-9_]+)"?.*enable row level security/);
    if (rls) rlsEnabled.add(rls[1]);

    // --- CREATE POLICY ---
    if (/^create policy/.test(lower)) {
      const nameMatch = s.match(/^create policy\s+"?([^"\s]+)"?/i);
      const name = nameMatch ? nameMatch[1] : '(sans nom)';
      const onTable = (lower.match(/ on (?:public\.)?"?([a-z0-9_]+)"?/) || [, '?'])[1];
      const label = `${onTable}.${name}`;

      const hasUsing = / using \(/.test(lower);
      const hasWithCheck = / with check \(/.test(lower);
      const hasTo = / to (authenticated|service_role|anon|public)/.test(lower);

      const cmd =
        (lower.match(/ for (all|select|insert|update|delete)/) || [, 'all'])[1];

      if (/using \(\s*true\s*\)/.test(lower) || /with check \(\s*true\s*\)/.test(lower)) {
        report('error', file, 'policy-always-true', `Policy ${label} utilise une condition toujours vraie.`);
      }
      if (!hasTo) {
        report(
          'error',
          file,
          'policy-missing-role',
          `Policy ${label} n'a pas de clause TO — elle s'applique au rôle public (anon inclus).`,
        );
      } else if (/ to public/.test(lower)) {
        report('error', file, 'policy-role-public', `Policy ${label} cible explicitement le rôle public.`);
      }
      if ((cmd === 'insert' || cmd === 'all') && !hasWithCheck) {
        report(
          'error',
          file,
          'policy-insert-missing-with-check',
          `Policy ${label} (${cmd.toUpperCase()}) autorise l'écriture sans WITH CHECK — usurpation possible.`,
        );
      }
      if (cmd === 'update' && !hasWithCheck) {
        report(
          'error',
          file,
          'policy-update-missing-with-check',
          `Policy ${label} (UPDATE) sans WITH CHECK — une ligne peut être réattribuée à un tiers.`,
        );
      }
      if ((cmd === 'select' || cmd === 'delete') && !hasUsing) {
        report('warn', file, 'policy-missing-using', `Policy ${label} (${cmd.toUpperCase()}) sans clause USING.`);
      }
    }
  }

  for (const t of createdTables) {
    if (!grantedTables.has(t)) {
      report(
        'error',
        file,
        'table-missing-grant',
        `Table public.${t} créée sans GRANT dans la même migration — la Data API renverra une erreur de permission.`,
      );
    }
    if (!rlsEnabled.has(t)) {
      report(
        'error',
        file,
        'table-missing-rls',
        `Table public.${t} créée sans ENABLE ROW LEVEL SECURITY — toutes les lignes sont exposées.`,
      );
    }
  }
}

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

console.log(`🔎 Analyse de ${files.length} migration(s)\n`);
for (const f of files) console.log(`   • ${f}`);
console.log('');

for (const f of [...errors, ...warns]) {
  const icon = f.level === 'error' ? '❌' : '⚠️ ';
  console.log(`${icon} [${f.rule}] ${f.file}\n     ${f.message}`);
}

console.log(`\nRésultat : ${errors.length} erreur(s), ${warns.length} avertissement(s).`);

if (errors.length) {
  console.log('\nCorrigez les erreurs ci-dessus avant de fusionner cette migration.');
  process.exit(1);
}
console.log('✅ Aucune régression de sécurité détectée dans les migrations analysées.');
