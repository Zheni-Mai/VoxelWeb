const express = require('express');
const path = require('path');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const prisma = new PrismaClient();

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "voxeladmin2025";

// Bảo mật admin (client-side vẫn dùng localStorage, server chỉ phục vụ file)
app.use('/admin', (req, res, next) => {
  if (req.path === '/login.html' || req.path === '/') next();
  else next();
});
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// API: Tổng lượt tải
app.get('/api/get-downloads', async (req, res) => {
  try {
    const total = await prisma.download.count();
    res.json({ count: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ count: 0 });
  }
});

// API: Tăng lượt tải theo phiên bản
app.post('/api/increment', async (req, res) => {
  try {
    const { version } = req.body;
    if (!version) return res.status(400).json({ success: false });

    const today = new Date().toISOString().split('T')[0];

    const download = await prisma.download.create({
      data: {
        version,
        day: today
      }
    });

    const total = await prisma.download.count();

    res.json({ success: true, total });
  } catch (err) {
    console.error('Lỗi increment:', err);
    res.status(500).json({ success: false });
  }
});

// API: Thống kê admin
app.get('/api/admin/stats', async (req, res) => {
  try {
    const total = await prisma.download.count();

    // Theo phiên bản
    const versionGroups = await prisma.download.groupBy({
      by: ['version'],
      _count: { version: true }
    });
    const versions = {};
    versionGroups.forEach(g => {
      versions[g.version] = g._count.version;
    });

    // Theo ngày (30 ngày gần nhất)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyGroups = await prisma.download.groupBy({
      by: ['day'],
      where: { date: { gte: thirtyDaysAgo } },
      _count: { day: true }
    });
    const daily = {};
    dailyGroups.forEach(g => {
      daily[g.day] = g._count.day;
    });

    res.json({ total, versions, daily });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API: Releases GitHub
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
    res.status(500).json({ error: "GitHub API lỗi" });
  }
});

// VirusTotal Links
app.get('/api/virustotal', async (req, res) => {
  try {
    const links = await prisma.virusTotalLink.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(links);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/admin/virustotal', async (req, res) => {
  try {
    const { version, url } = req.body;
    if (!version || !url) return res.status(400).json({ error: "Thiếu dữ liệu" });

    await prisma.virusTotalLink.create({
      data: { version, url }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/virustotal/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.virusTotalLink.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trang chính
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/virustotal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'virustotal.html')));
app.use((req, res) => res.status(404).send('<h2>Không tìm thấy trang!</h2>'));

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
  console.log('Đang sử dụng PostgreSQL (Prisma) thay cho Redis');
});