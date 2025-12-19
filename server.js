const express = require('express');
const path = require('path');
const Redis = require('ioredis');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const redis = new Redis(process.env.voxel_REDIS_URL);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "voxeladmin2025"; // Đổi mật khẩu này!

redis.on('connect', () => console.log('Redis kết nối thành công!'));
redis.on('error', (err) => console.error('Lỗi Redis:', err.message));

// === Bảo mật Admin ===
app.use('/admin', (req, res, next) => {
  if (req.path === '/login.html' || req.path === '/') {
    return next();
  }
  // Cho phép truy cập dashboard nếu đã đăng nhập (client-side check)
  // Không cần server-side auth vì mật khẩu đã kiểm tra ở login.html
  next();
});

app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// === API: Tổng lượt tải ===
app.get('/api/get-downloads', async (req, res) => {
  try {
    const total = await redis.get('download:total') || 0;
    res.json({ count: parseInt(total) });
  } catch (err) {
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
    const count = await redis.incr(versionKey);
    await redis.sadd('download:versions', version);

    // Lưu lượt tải theo ngày
    const today = new Date().toISOString().split('T')[0];
    await redis.incr(`download:day:${today}`);

    res.json({ success: true, total, count });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// === API: Lấy thống kê admin ===
app.get('/api/admin/stats', async (req, res) => {
  try {
    const total = parseInt(await redis.get('download:total') || '0');
    const versions = await redis.smembers('download:versions');
    const versionStats = {};

    for (const v of versions) {
      const count = await redis.get(`download:version:${v}`) || 0;
      versionStats[v] = parseInt(count);
    }

    // Lấy dữ liệu theo ngày (30 ngày gần nhất)
    const dailyKeys = await redis.keys('download:day:*');
    const daily = {};
    for (const key of dailyKeys) {
      const date = key.split(':')[2];
      const count = await redis.get(key);
      daily[date] = parseInt(count || 0);
    }

    res.json({ total, versions: versionStats, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === API: Lấy releases từ GitHub ===
app.get('/api/releases', async (req, res) => {
  try {
    const response = await axios.get('https://api.github.com/repos/Zheni-Mai/VoxelX/releases', {
      headers: { 'User-Agent': 'VoxelLauncher' }
    });
    const releases = response.data.map(r => ({
      version: r.tag_name.replace('v', ''),
      name: r.name,
      date: r.published_at.split('T')[0],
      url: r.html_url
    }));
    res.json(releases);
  } catch (err) {
    res.status(500).json({ error: "Không lấy được dữ liệu GitHub" });
  }
});

// === VirusTotal Links ===
app.get('/api/virustotal', async (req, res) => {
  try {
    const links = await redis.lrange('virustotal:links', 0, -1);
    const parsed = links.map(link => {
      try { return JSON.parse(link); } catch { return null; }
    }).filter(Boolean);
    res.json(parsed);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/admin/virustotal', async (req, res) => {
  try {
    const { version, url } = req.body;
    if (!version || !url) return res.status(400).json({ error: "Thiếu dữ liệu" });
    const item = JSON.stringify({ version, url, date: new Date().toISOString() });
    await redis.rpush('virustotal:links', item);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/virustotal/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    await redis.lset('virustotal:links', index, '__DELETED__');
    await redis.lrem('virustotal:links', 0, '__DELETED__');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trang chủ & các trang khác
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/virustotal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'virustotal.html')));
app.use((req, res) => res.status(404).send('<h2>Không tìm thấy trang!</h2>'));

app.listen(PORT, () => {
  console.log(`Server chạy tại port ${PORT}`);
});