import { list, put, getDownloadUrl } from '@vercel/blob';

const LEADS_BLOB_KEY = 'leads/iyagi-leads.json';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, source = 'landing' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const timestamp = new Date().toISOString();
    const newEntry = { email: email.trim().toLowerCase(), source, ts: timestamp };

    // 기존 leads.json 가져오기
    let leads = [];
    try {
      const { blobs } = await list({ prefix: 'leads/' });
      const existing = blobs.find(b => b.pathname === LEADS_BLOB_KEY);
      if (existing) {
        const resp = await fetch(existing.downloadUrl || existing.url);
        if (resp.ok) {
          leads = await resp.json();
        }
      }
    } catch (_) {
      leads = [];
    }

    // 중복 체크
    const isDuplicate = leads.some(l => l.email === newEntry.email);
    if (isDuplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    leads.push(newEntry);

    // Vercel Blob에 저장 (덮어쓰기)
    await put(LEADS_BLOB_KEY, JSON.stringify(leads, null, 2), {
      access: 'public',          // Blob은 URL을 알아야만 접근 가능 (외부 링크 미노출)
      contentType: 'application/json',
      addRandomSuffix: false,    // 고정 pathname 유지
      allowOverwrite: true,
    });

    return res.status(200).json({ ok: true, count: leads.length });

  } catch (err) {
    console.error('submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
