import express from "express";
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { execFile, spawn } from "child_process";

const execFileAsync = promisify(execFile);
const { Pool } = pg;

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const APP_SECRET = process.env.APP_SECRET || "change-me";
const MIGRATION_TOKEN = process.env.MIGRATION_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
);
const CHUNK_SIZE = 16 * 1024 * 1024;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não configurado.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("railway.internal") ? false : { rejectUnauthorized: false }
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

function nowIso() {
  return new Date().toISOString();
}

function cookieMap(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signSession(email) {
  const payload = JSON.stringify({
    email: email.toLowerCase(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  const encoded = b64url(payload);
  const sig = crypto.createHmac("sha256", APP_SECRET).update(encoded).digest("base64url");
  return encoded + "." + sig;
}

function verifySession(token) {
  try {
    const [encoded, sig] = String(token || "").split(".");
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac("sha256", APP_SECRET).update(encoded).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!data.email || Number(data.exp) < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

async function isAllowedEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (ADMIN_EMAILS.has(e)) return true;
  const result = await pool.query("SELECT 1 FROM allowed_emails WHERE email = $1", [e]);
  return !!result.rows[0];
}

async function auth(req, res, next) {
  const session = verifySession(cookieMap(req).mc_session);
  if (!session || !(await isAllowedEmail(session.email))) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
  req.user = {
    email: session.email,
    admin: ADMIN_EMAILS.has(session.email)
  };
  next();
}

function adminOnly(req, res, next) {
  if (!req.user?.admin) return res.status(403).json({ error: "Acesso administrativo necessário." });
  next();
}

function keyMaterial() {
  return crypto.createHash("sha256").update(APP_SECRET).digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptSecret(value) {
  const raw = Buffer.from(String(value), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function getSetting(key) {
  const r = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = $1", [key]);
  return r.rows[0]?.setting_value || null;
}

async function setSetting(key, value) {
  await pool.query(
    "INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES($1,$2,now()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=now()",
    [key, String(value)]
  );
}

async function getTelegramConfig() {
  const enc = await getSetting("telegram_bot_token_enc");
  const chatId = await getSetting("telegram_chat_id");
  if (!enc || !chatId) throw new Error("Telegram ainda não configurado.");
  return { token: decryptSecret(enc), chatId };
}

async function telegramJson(method, body) {
  const { token } = await getTelegramConfig();
  const r = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) throw new Error(data?.description || "Falha no Telegram.");
  return data.result;
}

async function sendTelegramDocument(buffer, filename, caption) {
  const { token, chatId } = await getTelegramConfig();

  for (let attempt = 1; attempt <= 5; attempt++) {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("disable_notification", "true");
    form.append("caption", String(caption || "").slice(0, 900));
    form.append("document", new Blob([buffer], { type: "application/octet-stream" }), filename);

    const r = await fetch("https://api.telegram.org/bot" + token + "/sendDocument", {
      method: "POST",
      body: form
    });
    const data = await r.json().catch(() => null);

    if (r.ok && data?.ok && data.result?.document?.file_id) {
      return {
        fileId: data.result.document.file_id,
        messageId: data.result.message_id,
        size: data.result.document.file_size || buffer.length
      };
    }

    if (r.status === 429 && attempt < 5) {
      const retry = Math.max(1, Number(data?.parameters?.retry_after || 2));
      await new Promise((resolve) => setTimeout(resolve, retry * 1000));
      continue;
    }

    throw new Error(data?.description || "Falha ao enviar bloco ao Telegram.");
  }

  throw new Error("Falha ao enviar bloco ao Telegram.");
}

async function telegramFileBuffer(fileId) {
  const { token } = await getTelegramConfig();
  const meta = await fetch(
    "https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(fileId)
  );
  const metaBody = await meta.json().catch(() => null);
  if (!meta.ok || !metaBody?.ok || !metaBody.result?.file_path) {
    throw new Error(metaBody?.description || "Bloco não localizado no Telegram.");
  }

  const data = await fetch(
    "https://api.telegram.org/file/bot" + token + "/" + metaBody.result.file_path
  );
  if (!data.ok) throw new Error("Falha ao recuperar bloco do Telegram.");
  return Buffer.from(await data.arrayBuffer());
}

async function deleteTelegramMessages(messageIds) {
  const ids = [...new Set((messageIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return;

  const { token, chatId } = await getTelegramConfig();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    await fetch("https://api.telegram.org/bot" + token + "/deleteMessages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_ids: batch })
    }).catch(() => null);
  }
}

async function initSchema() {
  const statements = [
    "CREATE TABLE IF NOT EXISTS allowed_emails (email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS app_settings (setting_key text PRIMARY KEY, setting_value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS media_folders (id uuid PRIMARY KEY, name text NOT NULL, parent_id uuid REFERENCES media_folders(id) ON DELETE CASCADE, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS media_assets (id uuid PRIMARY KEY, folder_id uuid REFERENCES media_folders(id) ON DELETE SET NULL, original_name text NOT NULL, original_format text NOT NULL, uploaded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS media_variants (id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE, format text NOT NULL CHECK(format IN ('mov','mp4')), mime_type text NOT NULL, size_bytes bigint NOT NULL DEFAULT 0, chunk_size integer NOT NULL DEFAULT 16777216, chunk_count integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'uploading', codec_video text, codec_audio text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(asset_id,format))",
    "CREATE TABLE IF NOT EXISTS media_chunks (id uuid PRIMARY KEY, variant_id uuid NOT NULL REFERENCES media_variants(id) ON DELETE CASCADE, part_no integer NOT NULL, telegram_file_id text NOT NULL, telegram_message_id bigint, size_bytes bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(variant_id,part_no))",
    "CREATE TABLE IF NOT EXISTS conversion_jobs (id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE, target_format text NOT NULL CHECK(target_format IN ('mov','mp4')), status text NOT NULL DEFAULT 'pending', progress integer NOT NULL DEFAULT 0, error text, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz)",
    "CREATE INDEX IF NOT EXISTS idx_assets_folder ON media_assets(folder_id)",
    "CREATE INDEX IF NOT EXISTS idx_variants_asset ON media_variants(asset_id)",
    "CREATE INDEX IF NOT EXISTS idx_chunks_variant ON media_chunks(variant_id,part_no)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_status ON conversion_jobs(status,created_at)"
  ];

  for (const sql of statements) await pool.query(sql);
  await pool.query("UPDATE conversion_jobs SET status='pending',progress=0,error=NULL WHERE status='running'");
  for (const email of ADMIN_EMAILS) {
    await pool.query("INSERT INTO allowed_emails(email) VALUES($1) ON CONFLICT DO NOTHING", [email]);
  }
}

app.get("/health", async (_req, res) => {
  const r = await pool.query("SELECT now() AS now");
  res.json({ ok: true, service: "midia-cloud", database: !!r.rows[0], time: r.rows[0].now });
});

app.post("/api/auth/start", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!(await isAllowedEmail(email))) {
      return res.status(403).json({ error: "Este e-mail ainda não foi autorizado." });
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: "Serviço de login ainda não configurado." });
    }

    const r = await fetch(SUPABASE_URL + "/auth/v1/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, create_user: true })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(400).json({ error: body?.msg || body?.message || "Não foi possível enviar o código." });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const token = String(req.body?.token || "").trim();
    if (!(await isAllowedEmail(email))) return res.status(403).json({ error: "E-mail não autorizado." });

    const r = await fetch(SUPABASE_URL + "/auth/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, token, type: "email" })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.user?.email) {
      return res.status(400).json({ error: body?.msg || body?.message || "Código inválido ou expirado." });
    }

    const session = signSession(body.user.email);
    res.setHeader(
      "Set-Cookie",
      "mc_session=" + encodeURIComponent(session) + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000"
    );
    res.json({ ok: true, user: { email: body.user.email, admin: ADMIN_EMAILS.has(body.user.email.toLowerCase()) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "mc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/library", auth, async (req, res) => {
  try {
    const folderId = req.query.folder ? String(req.query.folder) : null;
    const search = String(req.query.q || "").trim();

    let folders;
    let assets;

    if (search) {
      folders = await pool.query(
        "SELECT id,name,parent_id,created_at FROM media_folders WHERE lower(name) LIKE lower($1) ORDER BY name LIMIT 100",
        ["%" + search + "%"]
      );
      assets = await pool.query(
        "SELECT a.*, COALESCE((SELECT json_agg(json_build_object('id',v.id,'format',v.format,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'status',v.status,'codec_video',v.codec_video,'codec_audio',v.codec_audio,'completed_at',v.completed_at) ORDER BY v.format) FROM media_variants v WHERE v.asset_id=a.id),'[]'::json) AS variants, (SELECT row_to_json(j) FROM (SELECT id,target_format,status,progress,error FROM conversion_jobs WHERE asset_id=a.id AND status IN ('pending','running') ORDER BY created_at DESC LIMIT 1) j) AS job FROM media_assets a WHERE lower(a.original_name) LIKE lower($1) ORDER BY a.created_at DESC LIMIT 200",
        ["%" + search + "%"]
      );
    } else {
      folders = await pool.query(
        folderId
          ? "SELECT id,name,parent_id,created_at FROM media_folders WHERE parent_id=$1 ORDER BY name"
          : "SELECT id,name,parent_id,created_at FROM media_folders WHERE parent_id IS NULL ORDER BY name",
        folderId ? [folderId] : []
      );
      assets = await pool.query(
        folderId
          ? "SELECT a.*, COALESCE((SELECT json_agg(json_build_object('id',v.id,'format',v.format,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'status',v.status,'codec_video',v.codec_video,'codec_audio',v.codec_audio,'completed_at',v.completed_at) ORDER BY v.format) FROM media_variants v WHERE v.asset_id=a.id),'[]'::json) AS variants, (SELECT row_to_json(j) FROM (SELECT id,target_format,status,progress,error FROM conversion_jobs WHERE asset_id=a.id AND status IN ('pending','running') ORDER BY created_at DESC LIMIT 1) j) AS job FROM media_assets a WHERE a.folder_id=$1 ORDER BY a.created_at DESC"
          : "SELECT a.*, COALESCE((SELECT json_agg(json_build_object('id',v.id,'format',v.format,'mime_type',v.mime_type,'size_bytes',v.size_bytes,'status',v.status,'codec_video',v.codec_video,'codec_audio',v.codec_audio,'completed_at',v.completed_at) ORDER BY v.format) FROM media_variants v WHERE v.asset_id=a.id),'[]'::json) AS variants, (SELECT row_to_json(j) FROM (SELECT id,target_format,status,progress,error FROM conversion_jobs WHERE asset_id=a.id AND status IN ('pending','running') ORDER BY created_at DESC LIMIT 1) j) AS job FROM media_assets a WHERE a.folder_id IS NULL ORDER BY a.created_at DESC",
        folderId ? [folderId] : []
      );
    }

    let current = null;
    const breadcrumbs = [];
    if (folderId) {
      const r = await pool.query(
        "WITH RECURSIVE p AS (SELECT id,name,parent_id,1 depth FROM media_folders WHERE id=$1 UNION ALL SELECT f.id,f.name,f.parent_id,p.depth+1 FROM media_folders f JOIN p ON p.parent_id=f.id) SELECT * FROM p ORDER BY depth DESC",
        [folderId]
      );
      if (r.rows.length) {
        current = r.rows[r.rows.length - 1];
        for (const row of r.rows) breadcrumbs.push({ id: row.id, name: row.name });
      }
    }

    res.json({ folder: current, breadcrumbs, folders: folders.rows, assets: assets.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/folders", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().replace(/[\\/]+/g, " ").slice(0, 120);
    const parentId = req.body?.parentId || null;
    if (!name) return res.status(400).json({ error: "Nome da pasta obrigatório." });
    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO media_folders(id,name,parent_id,created_by) VALUES($1,$2,$3,$4)",
      [id, name, parentId, req.user.email]
    );
    res.json({ ok: true, folder: { id, name, parent_id: parentId } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/assets/:id", auth, async (req, res) => {
  try {
    const chunks = await pool.query(
      "SELECT c.telegram_message_id FROM media_chunks c JOIN media_variants v ON v.id=c.variant_id WHERE v.asset_id=$1 AND c.telegram_message_id IS NOT NULL",
      [req.params.id]
    );
    await deleteTelegramMessages(chunks.rows.map((r) => r.telegram_message_id));
    await pool.query("DELETE FROM media_assets WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/folders/:id", auth, async (req, res) => {
  try {
    const assets = await pool.query(
      "WITH RECURSIVE tree AS (SELECT id FROM media_folders WHERE id=$1 UNION ALL SELECT f.id FROM media_folders f JOIN tree t ON f.parent_id=t.id) SELECT a.id FROM media_assets a WHERE a.folder_id IN (SELECT id FROM tree)",
      [req.params.id]
    );
    for (const asset of assets.rows) {
      const chunks = await pool.query(
        "SELECT c.telegram_message_id FROM media_chunks c JOIN media_variants v ON v.id=c.variant_id WHERE v.asset_id=$1 AND c.telegram_message_id IS NOT NULL",
        [asset.id]
      );
      await deleteTelegramMessages(chunks.rows.map((r) => r.telegram_message_id));
    }
    await pool.query(
      "WITH RECURSIVE tree AS (SELECT id FROM media_folders WHERE id=$1 UNION ALL SELECT f.id FROM media_folders f JOIN tree t ON f.parent_id=t.id) DELETE FROM media_assets WHERE folder_id IN (SELECT id FROM tree)",
      [req.params.id]
    );
    await pool.query("DELETE FROM media_folders WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upload/start", auth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 500);
    const size = Number(req.body?.size || 0);
    const folderId = req.body?.folderId || null;
    const ext = path.extname(name).toLowerCase().replace(".", "");
    const format = ext === "mp4" ? "mp4" : ext === "mov" ? "mov" : null;
    if (!name || !format || !Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: "Envie um arquivo MOV ou MP4 válido." });
    }

    const assetId = crypto.randomUUID();
    const variantId = crypto.randomUUID();
    const chunkCount = Math.ceil(size / CHUNK_SIZE);
    await pool.query(
      "INSERT INTO media_assets(id,folder_id,original_name,original_format,uploaded_by) VALUES($1,$2,$3,$4,$5)",
      [assetId, folderId, name, format, req.user.email]
    );
    await pool.query(
      "INSERT INTO media_variants(id,asset_id,format,mime_type,size_bytes,chunk_size,chunk_count,status) VALUES($1,$2,$3,$4,$5,$6,$7,'uploading')",
      [variantId, assetId, format, format === "mp4" ? "video/mp4" : "video/quicktime", size, CHUNK_SIZE, chunkCount]
    );
    res.json({ assetId, variantId, chunkSize: CHUNK_SIZE, chunkCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put(
  "/api/upload/:variantId/chunk/:part",
  auth,
  express.raw({ type: "application/octet-stream", limit: "17mb" }),
  async (req, res) => {
    try {
      const partNo = Number(req.params.part);
      const variantId = req.params.variantId;
      if (!Number.isInteger(partNo) || partNo < 0 || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Bloco inválido." });
      }

      const v = await pool.query(
        "SELECT v.*,a.original_name FROM media_variants v JOIN media_assets a ON a.id=v.asset_id WHERE v.id=$1",
        [variantId]
      );
      if (!v.rows[0]) return res.status(404).json({ error: "Upload não encontrado." });

      const existing = await pool.query(
        "SELECT 1 FROM media_chunks WHERE variant_id=$1 AND part_no=$2",
        [variantId, partNo]
      );
      if (existing.rows[0]) return res.json({ ok: true, duplicate: true });

      const safe = v.rows[0].original_name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
      const tg = await sendTelegramDocument(
        req.body,
        safe + ".part-" + String(partNo + 1).padStart(4, "0"),
        "MÍDIA CLOUD · " + variantId + " · parte " + (partNo + 1) + "/" + v.rows[0].chunk_count
      );

      await pool.query(
        "INSERT INTO media_chunks(id,variant_id,part_no,telegram_file_id,telegram_message_id,size_bytes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(variant_id,part_no) DO NOTHING",
        [crypto.randomUUID(), variantId, partNo, tg.fileId, tg.messageId, req.body.length]
      );
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.post("/api/upload/:variantId/finish", auth, async (req, res) => {
  try {
    const v = await pool.query("SELECT * FROM media_variants WHERE id=$1", [req.params.variantId]);
    if (!v.rows[0]) return res.status(404).json({ error: "Upload não encontrado." });
    const c = await pool.query("SELECT count(*)::int n FROM media_chunks WHERE variant_id=$1", [req.params.variantId]);
    if (Number(c.rows[0].n) !== Number(v.rows[0].chunk_count)) {
      return res.status(409).json({ error: "Upload incompleto.", uploaded: c.rows[0].n, total: v.rows[0].chunk_count });
    }
    await pool.query(
      "UPDATE media_variants SET status='ready',completed_at=now() WHERE id=$1",
      [req.params.variantId]
    );
    res.json({ ok: true, assetId: v.rows[0].asset_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/assets/:id/convert", auth, async (req, res) => {
  try {
    const target = String(req.body?.target || "mp4").toLowerCase();
    if (!["mov", "mp4"].includes(target)) return res.status(400).json({ error: "Formato inválido." });

    const ready = await pool.query(
      "SELECT id,status FROM media_variants WHERE asset_id=$1 AND format=$2 AND status='ready'",
      [req.params.id, target]
    );
    if (ready.rows[0]) return res.json({ ok: true, alreadyReady: true, variantId: ready.rows[0].id });

    const pending = await pool.query(
      "SELECT id,status,progress FROM conversion_jobs WHERE asset_id=$1 AND target_format=$2 AND status IN ('pending','running') ORDER BY created_at DESC LIMIT 1",
      [req.params.id, target]
    );
    if (pending.rows[0]) return res.json({ ok: true, job: pending.rows[0] });

    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO conversion_jobs(id,asset_id,target_format,status,progress) VALUES($1,$2,$3,'pending',0)",
      [id, req.params.id, target]
    );
    res.json({ ok: true, job: { id, status: "pending", progress: 0 } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/assets/:id/download/:format", auth, async (req, res) => {
  try {
    const format = String(req.params.format).toLowerCase();
    const r = await pool.query(
      "SELECT v.*,a.original_name FROM media_variants v JOIN media_assets a ON a.id=v.asset_id WHERE v.asset_id=$1 AND v.format=$2 AND v.status='ready'",
      [req.params.id, format]
    );
    const variant = r.rows[0];
    if (!variant) return res.status(404).json({ error: "Formato ainda não disponível." });

    const chunks = await pool.query(
      "SELECT * FROM media_chunks WHERE variant_id=$1 ORDER BY part_no",
      [variant.id]
    );
    const base = path.basename(variant.original_name, path.extname(variant.original_name));
    const filename = base + "." + format;
    res.setHeader("Content-Type", variant.mime_type);
    res.setHeader("Content-Disposition", 'attachment; filename="' + filename.replace(/"/g, "_") + '"');
    res.setHeader("Content-Length", String(variant.size_bytes));
    res.setHeader("Cache-Control", "private, no-store");

    for (const chunk of chunks.rows) {
      const buffer = await telegramFileBuffer(chunk.telegram_file_id);
      if (!res.write(buffer)) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
    else res.end();
  }
});

app.post("/api/admin/invite", auth, adminOnly, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "E-mail inválido." });
  await pool.query("INSERT INTO allowed_emails(email) VALUES($1) ON CONFLICT DO NOTHING", [email]);
  res.json({ ok: true, email });
});

app.get("/api/admin/invites", auth, adminOnly, async (_req, res) => {
  const r = await pool.query("SELECT email,created_at FROM allowed_emails ORDER BY created_at DESC");
  res.json({ emails: r.rows });
});

app.post("/internal/migrate", async (req, res) => {
  try {
    if (!MIGRATION_TOKEN || req.headers["x-migration-token"] !== MIGRATION_TOKEN) {
      return res.status(403).json({ error: "Migração não autorizada." });
    }

    const payload = req.body || {};
    if (payload.telegram_bot_token) {
      await setSetting("telegram_bot_token_enc", encryptSecret(payload.telegram_bot_token));
    }
    if (payload.telegram_chat_id) await setSetting("telegram_chat_id", payload.telegram_chat_id);
    if (payload.telegram_chat_title) await setSetting("telegram_chat_title", payload.telegram_chat_title);

    for (const email of payload.allowed_emails || []) {
      await pool.query("INSERT INTO allowed_emails(email) VALUES($1) ON CONFLICT DO NOTHING", [String(email).toLowerCase()]);
    }

    for (const folder of payload.folders || []) {
      await pool.query(
        "INSERT INTO media_folders(id,name,parent_id,created_by,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
        [folder.id, folder.name, folder.parent_id || null, folder.created_by || "migracao", folder.created_at || nowIso()]
      );
    }

    let importedFiles = 0;
    for (const file of payload.files || []) {
      const assetId = file.id;
      const ext = path.extname(file.original_name || "").toLowerCase().replace(".", "");
      const format = ext === "mp4" ? "mp4" : "mov";
      await pool.query(
        "INSERT INTO media_assets(id,folder_id,original_name,original_format,uploaded_by,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
        [assetId, file.folder_id || null, file.original_name, format, file.uploaded_by || "migracao", file.created_at || nowIso()]
      );

      const exists = await pool.query("SELECT id FROM media_variants WHERE asset_id=$1 AND format=$2", [assetId, format]);
      let variantId = exists.rows[0]?.id;
      if (!variantId) {
        variantId = crypto.randomUUID();
        await pool.query(
          "INSERT INTO media_variants(id,asset_id,format,mime_type,size_bytes,chunk_size,chunk_count,status,created_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [variantId, assetId, format, file.mime_type || (format === "mp4" ? "video/mp4" : "video/quicktime"), file.size_bytes || 0, file.chunk_size || CHUNK_SIZE, file.chunk_count || 0, file.status === "ready" ? "ready" : "uploading", file.created_at || nowIso(), file.completed_at || null]
        );
      }

      for (const chunk of file.chunks || []) {
        await pool.query(
          "INSERT INTO media_chunks(id,variant_id,part_no,telegram_file_id,telegram_message_id,size_bytes,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(variant_id,part_no) DO NOTHING",
          [chunk.id || crypto.randomUUID(), variantId, chunk.part_no, chunk.telegram_file_id, chunk.telegram_message_id || null, chunk.size_bytes || 0, chunk.created_at || nowIso()]
        );
      }
      importedFiles++;
    }

    res.json({ ok: true, importedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function downloadVariantToFile(variantId, outputPath) {
  const chunks = await pool.query("SELECT * FROM media_chunks WHERE variant_id=$1 ORDER BY part_no", [variantId]);
  const stream = fs.createWriteStream(outputPath);
  for (const chunk of chunks.rows) {
    const buffer = await telegramFileBuffer(chunk.telegram_file_id);
    if (!stream.write(buffer)) await new Promise((resolve) => stream.once("drain", resolve));
  }
  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on("error", reject);
  });
}

async function probeFile(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-show_entries", "stream=codec_type,codec_name",
    "-of", "json",
    filePath
  ]);
  const data = JSON.parse(stdout);
  const video = data.streams?.find((s) => s.codec_type === "video")?.codec_name || "";
  const audio = data.streams?.find((s) => s.codec_type === "audio")?.codec_name || "";
  const duration = Number(data.format?.duration || 0);
  return { video, audio, duration };
}

async function runFfmpeg(jobId, inputPath, outputPath, targetFormat, probe) {
  const args = ["-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?"];

  const directCopy = probe.video === "h264" && (!probe.audio || probe.audio === "aac");
  if (directCopy) {
    args.push("-c", "copy");
    if (targetFormat === "mp4") args.push("-tag:v", "avc1", "-movflags", "+faststart");
  } else {
    args.push(
      "-vf", "scale=min(1920\\,iw):min(1920\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-tag:v", "avc1",
      "-c:a", "aac",
      "-b:a", "160k"
    );
    if (targetFormat === "mp4") args.push("-movflags", "+faststart");
  }

  args.push("-progress", "pipe:1", "-nostats", outputPath);

  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let lastUpdate = 0;

    child.stdout.on("data", async (chunk) => {
      const text = chunk.toString();
      const match = text.match(/out_time_ms=(\d+)/);
      if (!match || !probe.duration) return;
      const elapsedUs = Number(match[1]);
      const pct = Math.max(10, Math.min(70, Math.round(10 + (elapsedUs / (probe.duration * 1000000)) * 60)));
      const now = Date.now();
      if (now - lastUpdate > 1500) {
        lastUpdate = now;
        pool.query("UPDATE conversion_jobs SET progress=$2 WHERE id=$1", [jobId, pct]).catch(() => null);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("FFmpeg falhou: " + stderr.slice(-2000)));
    });
  });
}

async function replaceVariantFromFile(assetId, targetFormat, filePath, probe, jobId) {
  const old = await pool.query("SELECT id FROM media_variants WHERE asset_id=$1 AND format=$2", [assetId, targetFormat]);
  if (old.rows[0]) {
    const messages = await pool.query(
      "SELECT telegram_message_id FROM media_chunks WHERE variant_id=$1 AND telegram_message_id IS NOT NULL",
      [old.rows[0].id]
    );
    await deleteTelegramMessages(messages.rows.map((r) => r.telegram_message_id));
    await pool.query("DELETE FROM media_variants WHERE id=$1", [old.rows[0].id]);
  }

  const stat = fs.statSync(filePath);
  const variantId = crypto.randomUUID();
  const count = Math.ceil(stat.size / CHUNK_SIZE);
  await pool.query(
    "INSERT INTO media_variants(id,asset_id,format,mime_type,size_bytes,chunk_size,chunk_count,status,codec_video,codec_audio) VALUES($1,$2,$3,$4,$5,$6,$7,'processing',$8,$9)",
    [variantId, assetId, targetFormat, targetFormat === "mp4" ? "video/mp4" : "video/quicktime", stat.size, CHUNK_SIZE, count, targetFormat === "mp4" ? "h264" : probe.video, targetFormat === "mp4" ? "aac" : probe.audio]
  );

  const fh = fs.openSync(filePath, "r");
  try {
    for (let part = 0; part < count; part++) {
      const start = part * CHUNK_SIZE;
      const size = Math.min(CHUNK_SIZE, stat.size - start);
      const buffer = Buffer.allocUnsafe(size);
      fs.readSync(fh, buffer, 0, size, start);
      const tg = await sendTelegramDocument(
        buffer,
        targetFormat + "-" + assetId + ".part-" + String(part + 1).padStart(4, "0"),
        "MÍDIA CLOUD · " + targetFormat.toUpperCase() + " · " + assetId + " · " + (part + 1) + "/" + count
      );
      await pool.query(
        "INSERT INTO media_chunks(id,variant_id,part_no,telegram_file_id,telegram_message_id,size_bytes) VALUES($1,$2,$3,$4,$5,$6)",
        [crypto.randomUUID(), variantId, part, tg.fileId, tg.messageId, size]
      );
      const pct = Math.round(72 + ((part + 1) / count) * 26);
      await pool.query("UPDATE conversion_jobs SET progress=$2 WHERE id=$1", [jobId, pct]);
    }
  } finally {
    fs.closeSync(fh);
  }

  await pool.query("UPDATE media_variants SET status='ready',completed_at=now() WHERE id=$1", [variantId]);
  return variantId;
}

let workerBusy = false;

async function processNextJob() {
  if (workerBusy) return;
  workerBusy = true;
  let tempDir = null;

  try {
    const r = await pool.query(
      "SELECT j.*,a.original_name,a.original_format FROM conversion_jobs j JOIN media_assets a ON a.id=j.asset_id WHERE j.status='pending' ORDER BY j.created_at LIMIT 1"
    );
    const job = r.rows[0];
    if (!job) return;

    await pool.query("UPDATE conversion_jobs SET status='running',progress=2,started_at=now(),error=NULL WHERE id=$1", [job.id]);

    const source = await pool.query(
      "SELECT * FROM media_variants WHERE asset_id=$1 AND status='ready' ORDER BY CASE WHEN format=$2 THEN 0 ELSE 1 END, completed_at DESC LIMIT 1",
      [job.asset_id, job.original_format]
    );
    if (!source.rows[0]) throw new Error("Nenhuma variante de origem disponível.");

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "midia-cloud-"));
    const inputPath = path.join(tempDir, "input." + source.rows[0].format);
    const outputPath = path.join(tempDir, "output." + job.target_format);

    await pool.query("UPDATE conversion_jobs SET progress=5 WHERE id=$1", [job.id]);
    await downloadVariantToFile(source.rows[0].id, inputPath);

    const probe = await probeFile(inputPath);
    await pool.query("UPDATE conversion_jobs SET progress=9 WHERE id=$1", [job.id]);
    await runFfmpeg(job.id, inputPath, outputPath, job.target_format, probe);

    const outProbe = await probeFile(outputPath);
    const variantId = await replaceVariantFromFile(job.asset_id, job.target_format, outputPath, outProbe, job.id);

    await pool.query(
      "UPDATE conversion_jobs SET status='completed',progress=100,completed_at=now(),error=NULL WHERE id=$1",
      [job.id]
    );
    console.log("Conversion completed", job.id, variantId);
  } catch (error) {
    console.error("Conversion failed", error);
    const running = await pool.query("SELECT id FROM conversion_jobs WHERE status='running' ORDER BY started_at DESC LIMIT 1");
    if (running.rows[0]) {
      await pool.query(
        "UPDATE conversion_jobs SET status='failed',error=$2,completed_at=now() WHERE id=$1",
        [running.rows[0].id, String(error.message || error).slice(0, 2000)]
      );
    }
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    workerBusy = false;
  }
}

setInterval(() => {
  processNextJob().catch((error) => console.error("Worker error", error));
}, 2500);

app.use(express.static(path.join(process.cwd(), "public")));
app.get("*", (_req, res) => res.sendFile(path.join(process.cwd(), "public", "index.html")));

await initSchema();

app.listen(PORT, "0.0.0.0", () => {
  console.log("Mídia Cloud listening on", PORT);
});
