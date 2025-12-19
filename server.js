const express = require('express');
const path = require('path');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const redis = new Redis(process.env.voxel_REDIS_URL);

redis.on('connect', () => {
  console.log('Kết nối RedisLabs thành công!');
  console.log(`URL: ${process.env.voxel_REDIS_URL ? 'Đã kết nối' : 'Chưa cấu hình'}`);
});

redis.on('error', (err) => {
  console.error('Lỗi Redis:', err.message);
});

app.get('/api/get-downloads', async (req, res) => {
  try {
    const count = await redis.get('download_count');
    res.json({ count: parseInt(count || '0') });
  } catch (err) {
    console.error('Redis GET error:', err.message);
    res.status(500).json({ count: 0 });
  }
});

app.post('/api/increment', async (req, res) => {
  try {
    const count = await redis.incr('download_count');
    res.json({ success: true, count });
  } catch (err) {
    console.error('Redis INCR error:', err.message);
    res.status(500).json({ success: false });
  }
});

app.get('/redirect', (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('<h2>Không có URL tải xuống!</h2>');
  }
  res.sendFile(path.join(__dirname, 'public', 'redirect.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).send('<h2>Không tìm thấy trang!</h2>');
});

app.listen(PORT, () => {
  console.log(`Server chạy tại: http://localhost:${PORT}`);
  console.log(`Lưu lượt tải vĩnh viễn bằng RedisLabs (Redis)`);
});
