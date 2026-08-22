#!/usr/bin/env node
/*
  REDDY ANNA COIN — JSON -> PostgreSQL migration
  Based on the current project structure:
    users_data.json: users, claims, wallet, bets, games,
                     coinRequests, withdrawals, withdrawalDetails
    data.json: settings, bonusCodes, depositSettings

  SAFETY:
  - This script DOES NOT delete or modify the source JSON files.
  - It uses PostgreSQL transactions for each dataset.
  - It preserves original record IDs and stores the complete original
    object in raw_data JSONB, so fields are not silently lost.
  - Run against a NEW/EMPTY PostgreSQL database first.
  - It does not touch cricket/live-match API variables or OddsPapi variables.
*/

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = process.env.MIGRATION_ROOT || __dirname;
const USERS_FILE = process.env.USER_DATA_FILE || path.join(ROOT, 'users_data.json');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data.json');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

const usersData = readJson(USERS_FILE);
const appData = readJson(DATA_FILE);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable'
    ? false
    : { rejectUnauthorized: false }
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  created TIMESTAMPTZ,
  name TEXT NOT NULL DEFAULT '',
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT,
  value NUMERIC(18,2),
  time TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS claims_uid_idx ON claims(uid);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  type TEXT,
  note TEXT,
  time TIMESTAMPTZ,
  balance NUMERIC(18,2),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS wallet_uid_time_idx
  ON wallet_transactions(uid, time DESC);

CREATE TABLE IF NOT EXISTS match_bets (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market TEXT,
  odds NUMERIC(18,6),
  stake NUMERIC(18,2),
  possible_win NUMERIC(18,2),
  status TEXT,
  time TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS match_bets_uid_time_idx
  ON match_bets(uid, time DESC);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT,
  stake NUMERIC(18,2),
  mult NUMERIC(18,6),
  win NUMERIC(18,2),
  result TEXT,
  time TIMESTAMPTZ,
  balance NUMERIC(18,2),
  status TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS games_uid_time_idx
  ON games(uid, time DESC);

CREATE TABLE IF NOT EXISTS coin_requests (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT,
  amount NUMERIC(18,2),
  details TEXT,
  method TEXT,
  utr TEXT,
  screenshot TEXT,
  status TEXT,
  time TIMESTAMPTZ,
  handled_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS coin_requests_uid_time_idx
  ON coin_requests(uid, time DESC);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins NUMERIC(18,2),
  ifsc TEXT,
  account_number TEXT,
  status TEXT,
  time TIMESTAMPTZ,
  handled_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS withdrawals_uid_time_idx
  ON withdrawals(uid, time DESC);

CREATE TABLE IF NOT EXISTS withdrawal_details (
  uid TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ifsc TEXT,
  account_number TEXT,
  password TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS aviator_bets (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id TEXT,
  stake NUMERIC(18,2),
  status TEXT,
  placed_at TIMESTAMPTZ,
  cashout_multiplier NUMERIC(18,6),
  payout NUMERIC(18,2),
  settled_at TIMESTAMPTZ,
  settle_multiplier NUMERIC(18,6),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS aviator_bets_uid_time_idx
  ON aviator_bets(uid, placed_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function insertUser(client, u) {
  const id = String(u.id || '').trim();
  if (!id) return false;
  await client.query(`
    INSERT INTO users(id,password,balance,created,name,raw_data)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(id) DO NOTHING
  `, [
    id,
    String(u.password || ''),
    Number(u.balance || 0),
    u.created ? new Date(u.created) : null,
    String(u.name || ''),
    u
  ]);
  return true;
}

async function insertClaims(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO claims(id,uid,code,value,time,raw_data)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), x.code ?? null,
      Number(x.value || 0), x.time ? new Date(x.time) : null, x
    ]);
  }
}

async function insertWallet(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO wallet_transactions
      (id,uid,amount,type,note,time,balance,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), Number(x.amount || 0),
      x.type ?? null, x.note ?? null, x.time ? new Date(x.time) : null,
      x.balance == null ? null : Number(x.balance), x
    ]);
  }
}

async function insertBets(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO match_bets
      (id,uid,market,odds,stake,possible_win,status,time,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), x.market ?? null,
      x.odds == null ? null : Number(x.odds),
      x.stake == null ? null : Number(x.stake),
      x.possibleWin == null ? null : Number(x.possibleWin),
      x.status ?? null, x.time ? new Date(x.time) : null, x
    ]);
  }
}

async function insertGames(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO games
      (id,uid,game,stake,mult,win,result,time,balance,status,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), x.game ?? null,
      x.stake == null ? null : Number(x.stake),
      x.mult == null ? null : Number(x.mult),
      x.win == null ? null : Number(x.win),
      x.result ?? null, x.time ? new Date(x.time) : null,
      x.balance == null ? null : Number(x.balance),
      x.status ?? null, x
    ]);
  }
}

async function insertCoinRequests(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO coin_requests
      (id,uid,kind,amount,details,method,utr,screenshot,status,time,handled_at,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), x.kind ?? null,
      x.amount == null ? null : Number(x.amount),
      x.details ?? null, x.method ?? null, x.utr ?? null,
      x.screenshot ?? null, x.status ?? null,
      x.time ? new Date(x.time) : null,
      x.handledAt ? new Date(x.handledAt) : null,
      x
    ]);
  }
}

async function insertWithdrawals(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO withdrawals
      (id,uid,coins,ifsc,account_number,status,time,handled_at,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid),
      x.coins == null ? null : Number(x.coins),
      x.ifsc ?? null, x.accountNumber ?? null,
      x.status ?? null, x.time ? new Date(x.time) : null,
      x.handledAt ? new Date(x.handledAt) : null, x
    ]);
  }
}

async function insertWithdrawalDetails(client, details) {
  for (const [uid, x] of Object.entries(obj(details))) {
    if (!uid || !x) continue;
    await client.query(`
      INSERT INTO withdrawal_details
      (uid,ifsc,account_number,password,created_at,updated_at,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(uid) DO NOTHING
    `, [
      uid, x.ifsc ?? null, x.accountNumber ?? null, x.password ?? null,
      x.createdAt ? new Date(x.createdAt) : null,
      x.updatedAt ? new Date(x.updatedAt) : null, x
    ]);
  }
}

async function insertAviatorBets(client, rows) {
  for (const x of rows) {
    if (!x?.id || !x?.uid) continue;
    await client.query(`
      INSERT INTO aviator_bets
      (id,uid,round_id,stake,status,placed_at,cashout_multiplier,payout,settled_at,settle_multiplier,raw_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(id) DO NOTHING
    `, [
      String(x.id), String(x.uid), x.roundId ?? null,
      x.stake == null ? null : Number(x.stake),
      x.status ?? null,
      x.placedAt ? new Date(x.placedAt) : null,
      x.multiplier == null ? null : Number(x.multiplier),
      x.payout == null ? null : Number(x.payout),
      x.settledAt ? new Date(x.settledAt) : null,
      x.settleMultiplier == null ? null : Number(x.settleMultiplier),
      x
    ]);
  }
}

async function putSettings(client, data) {
  const keys = ['settings','bonusCodes','depositSettings'];
  for (const key of keys) {
    if (data[key] !== undefined) {
      await client.query(`
        INSERT INTO app_settings(key,value)
        VALUES($1,$2)
        ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
      `, [key, data[key]]);
    }
  }
}

async function count(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function main() {
  console.log('Source users file:', USERS_FILE);
  console.log('Source data file :', DATA_FILE);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);

    const users = obj(usersData.users);
    for (const u of Object.values(users)) await insertUser(client, u);

    await insertClaims(client, arr(usersData.claims));
    await insertWallet(client, arr(usersData.wallet));
    await insertBets(client, arr(usersData.bets));
    await insertGames(client, arr(usersData.games));
    await insertCoinRequests(client, arr(usersData.coinRequests));
    await insertWithdrawals(client, arr(usersData.withdrawals));
    await insertWithdrawalDetails(client, usersData.withdrawalDetails);
    await insertAviatorBets(client, arr(usersData.aviatorBets));
    await putSettings(client, appData);

    const sourceCounts = {
      users: Object.keys(users).length,
      claims: arr(usersData.claims).length,
      wallet: arr(usersData.wallet).length,
      bets: arr(usersData.bets).length,
      games: arr(usersData.games).length,
      coinRequests: arr(usersData.coinRequests).length,
      withdrawals: arr(usersData.withdrawals).length,
      withdrawalDetails: Object.keys(obj(usersData.withdrawalDetails)).length,
      aviatorBets: arr(usersData.aviatorBets).length
    };

    const dbCounts = {
      users: await count(client, 'users'),
      claims: await count(client, 'claims'),
      wallet: await count(client, 'wallet_transactions'),
      bets: await count(client, 'match_bets'),
      games: await count(client, 'games'),
      coinRequests: await count(client, 'coin_requests'),
      withdrawals: await count(client, 'withdrawals'),
      withdrawalDetails: await count(client, 'withdrawal_details'),
      aviatorBets: await count(client, 'aviator_bets')
    };

    await client.query(`
      INSERT INTO migration_meta(key,value)
      VALUES($1,$2)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value
    `, ['json_migration_v1', {
      sourceCounts,
      dbCounts,
      usersFile: USERS_FILE,
      dataFile: DATA_FILE,
      migratedAt: new Date().toISOString()
    }]);

    await client.query('COMMIT');

    console.log('\nMigration completed successfully.');
    console.log(JSON.stringify({ sourceCounts, dbCounts }, null, 2));

    for (const [k, n] of Object.entries(sourceCounts)) {
      if (dbCounts[k] < n) {
        console.error(`WARNING: ${k}: source=${n}, database=${dbCounts[k]}`);
        process.exitCode = 2;
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration FAILED. Transaction rolled back.');
    console.error(err.stack || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
