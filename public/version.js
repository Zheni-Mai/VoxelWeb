const API_URL = 'https://api.github.com/repos/Zheni-Mai/VoxelX/releases';
    const container = document.getElementById('releases-container');
    const searchInput = document.getElementById('searchInput');
    const modal = document.getElementById('changelog-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('changelog-body');
    const closeModal = document.querySelector('.close-modal');

    let releases = [];

    // Fetch releases
    async function fetchReleases() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Không tải được dữ liệu');
        releases = await res.json();
        renderReleases(releases);
      } catch (err) {
        container.innerHTML = `<div class="no-results">Lỗi: ${err.message}. Vui lòng thử lại sau.</div>`;
      }
    }

    // Render table
    function renderReleases(data) {
      if (data.length === 0) {
        container.innerHTML = '<div class="no-results">Không tìm thấy phiên bản nào.</div>';
        return;
      }

      let html = `
        <table class="releases-table">
          <thead>
            <tr>
              <th>Phiên bản</th>
              <th>Ngày phát hành</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
      `;

      data.forEach(release => {
        const tag = release.tag_name;
        const date = new Date(release.published_at).toLocaleDateString('vi-VN');
        const exeAsset = release.assets.find(a => a.name.includes('Setup.exe') || a.name.includes('.exe'));
        const downloadUrl = exeAsset ? exeAsset.browser_download_url : null;

        html += `
          <tr>
            <td>
              <div class="release-tag">${tag}</div>
            </td>
            <td>
              <div class="release-date">${date}</div>
            </td>
            <td>
              ${downloadUrl ? `<a href="${downloadUrl}" class="btn btn-download" target="_blank">
                <i class="fas fa-download"></i> Tải xuống
              </a>` : '<span class="text-muted">Không có file</span>'}
              <a href="#" class="btn btn-changelog" onclick="openChangelog('${release.tag_name}', \`${escapeHtml(release.body || 'Không có changelog')}\`)">
                <i class="fas fa-list"></i> Changelog
              </a>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    }

    // Search
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const filtered = releases.filter(r => r.tag_name.toLowerCase().includes(query));
      renderReleases(filtered);
    });

    // Open changelog modal
    function openChangelog(tag, body) {
      modalTitle.textContent = `Changelog - ${tag}`;
      modalBody.textContent = body;
      modal.classList.add('active');
    }

    // Close modal
    closeModal.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Start

    fetchReleases();
