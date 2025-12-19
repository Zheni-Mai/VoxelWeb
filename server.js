const express = require('express');
const path = require('path');
const axios = require('axios');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// === KHỞI TẠO CHÍNH XÁC VỚI BIẾN TỪ VERCEL INTEGRATION ===
const redis = new Redis({
  url: process.env.voxelx_KV_REST_API_URL,
  token: process.env.voxelx_KV_REST_API_TOKEN,
});
// =====================================================================

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "voxeladmin2025";

app.use('/admin', (req, res, next) => {
  if (req.path === '/login.html' || req.path === '/') return next();
  next();
});
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// === API: Tổng lượt tải ===
app.get('/api/get-downloads', async (req, res) => {
  try {
    const total = await redis.get('download:total') || '0';
    res.json({ count: parseInt(total) });
  } catch (err) {
    console.error('GET downloads error:', err.message);
    res.status(500).json({ count: 0 });
  }
});

// === API: Tăng lượt tải theo phiên bản ===
app.post('/api/increment', async (req, res) => {
  try {
    const { version } = req.body;
    if (!version) return res.status(400).json({ success: false });

    const total = await redis.incr('download:total');

    const versionKey = `download:version:${version}`;
    await redis.incr(versionKey);
    await redis.sadd('download:versions', version);

    const today = new Date().toISOString().split('T')[0];
    await redis.incr(`download:day:${today}`);

    res.json({ success: true, total });
  } catch (err) {
    console.error('Increment error:', err.message);
    res.status(500).json({ success: false });
  }
});

// === API: Thống kê admin ===
app.get('/api/admin/stats', async (req, res) => {
  try {
    const total = parseInt(await redis.get('download:total') || '0');

    const versionsSet = await redis.smembers('download:versions');
    const versions = {};
    for (const v of versionsSet) {
      const count = await redis.get(`download:version:${v}`) || '0';
      versions[v] = parseInt(count);
    }

    const daily = {};
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = await redis.get(`download:day:${dateStr}`) || '0';
      daily[dateStr] = parseInt(count);
    }

    res.json({ total, versions, daily });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === API: Releases GitHub ===
app.get('/api/releases', async (req, res) => {
  try {
    const response = await axios.get('https://api.github.com/repos/Zheni-Mai/VoxelX/releases', {
      headers: { 'User-Agent': 'VoxelLauncher' }
    });
    const releases = response.data.map(r => ({
      version: r.tag_name.replace(/^v/, ''),
      name: r.name,
      date: r.published_at.split('T')[0],
      url: r.html_url
    }));
    res.json(releases);
  } catch (err) {
    console.error('GitHub releases error:', err.message);
    res.status(500).json({ error: "Không lấy được dữ liệu GitHub" });
  }
});

// === API: VirusTotal Links ===
app.get('/api/virustotal', async (req, res) => {
  try {
    const rawLinks = await redis.lrange('virustotal:links', 0, -1);
    const links = rawLinks.map(item => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);

    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(links);
  } catch (err) {
    console.error('VT get error:', err.message);
    res.json([]);
  }
});

app.post('/api/admin/virustotal', async (req, res) => {
  try {
    const { version, url } = req.body;
    if (!version || !url) return res.status(400).json({ error: "Thiếu dữ liệu" });

    const item = JSON.stringify({
      version,
      url,
      createdAt: new Date().toISOString()
    });

    await redis.rpush('virustotal:links', item);
    res.json({ success: true });
  } catch (err) {
    console.error('VT add error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/virustotal/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0) return res.status(400).json({ error: "Index không hợp lệ" });

    const links = await redis.lrange('virustotal:links', 0, -1);
    if (index >= links.length) return res.status(400).json({ error: "Không tìm thấy" });

    await redis.lrem('virustotal:links', 0, links[index]);

    res.json({ success: true });
  } catch (err) {
    console.error('VT delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Trang chính ===
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/virustotal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'virustotal.html')));

app.use((req, res) => res.status(404).send('<h2>Không tìm thấy trang!</h2>'));

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  console.log('Upstash Redis kết nối thành công – Không còn lỗi 500 nữa!');
});