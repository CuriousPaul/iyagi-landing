import { list } from '@vercel/blob';

const LEADS_BLOB_KEY = 'leads/iyagi-leads.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Secret key 검증 — 환경변수 LEADS_SECRET 필요
  const secret = req.headers['x-leads-secret'] || req.query.secret;
  const expectedSecret = process.env.LEADS_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({ error: 'Server misconfigured: LEADS_SECRET not set' });
  }

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { blobs } = await list({ prefix: 'leads/' });
    const existing = blobs.find(b => b.pathname === LEADS_BLOB_KEY);

    if (!existing) {
      return res.status(200).json({ ok: true, count: 0, leads: [] });
    }

    const resp = await fetch(existing.downloadUrl || existing.url);
    if (!resp.ok) throw new Error('Failed to fetch blob');

    const leads = await resp.json();

    // 응답 캐시 비활성화
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      count: leads.length,
      leads: leads.map(l => ({
        email: l.email,
        source: l.source,
        ts: l.ts,
      })),
    });

  } catch (err) {
    console.error('leads fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
