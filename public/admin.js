// Admin dashboard – live stats, charts, and table with smooth updates
let countryChart, cityChart, browserChart, deviceChart;
let currentPage = 1;
const limit = 20;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Create or update a chart without destroying it (prevents flickering)
function createOrUpdateChart(canvasId, labels, data, existingChart, setChartRef) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  if (existingChart) {
    // Update existing chart data
    existingChart.data.labels = labels;
    existingChart.data.datasets[0].data = data;
    existingChart.update();
    return;
  }

  // Create new chart
  const ctx = canvas.getContext('2d');
  const type = labels.length <= 6 ? 'pie' : 'bar';
  const newChart = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: 'Visitors',
        data: data,
        backgroundColor: [
          '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899',
          '#06b6d4', '#f97316', '#84cc16', '#6366f1'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e2e8f0' }
        }
      },
      scales: type === 'bar' ? {
        y: { beginAtZero: true, ticks: { color: '#e2e8f0' } },
        x: { ticks: { color: '#e2e8f0' } }
      } : {}
    }
  });
  setChartRef(newChart);
}

async function loadStatsAndCharts() {
  try {
    const stats = await fetchJSON('/api/stats');
    document.getElementById('totalVisitors').textContent = stats.totalVisitors;
    document.getElementById('todayVisitors').textContent = stats.todayVisitors;
    document.getElementById('onlineVisitors').textContent = stats.onlineVisitors;

    const countrySelect = document.getElementById('countryFilter');
    const citySelect = document.getElementById('cityFilter');
    const currentCountryVal = countrySelect.value;
    const currentCityVal = citySelect.value;

    countrySelect.innerHTML = '<option value="">All Countries</option>';
    stats.countries.forEach(c => {
      countrySelect.innerHTML += `<option value="${c.country}">${c.country} (${c.count})</option>`;
    });
    countrySelect.value = currentCountryVal;

    citySelect.innerHTML = '<option value="">All Cities</option>';
    stats.cities.forEach(c => {
      citySelect.innerHTML += `<option value="${c.city}">${c.city} (${c.count})</option>`;
    });
    citySelect.value = currentCityVal;

    // Update charts smoothly
    createOrUpdateChart('countryChart', stats.countries.map(c => c.country), stats.countries.map(c => c.count), countryChart, (c) => countryChart = c);
    createOrUpdateChart('cityChart', stats.cities.map(c => c.city), stats.cities.map(c => c.count), cityChart, (c) => cityChart = c);
    createOrUpdateChart('browserChart', stats.browsers.map(b => b.browser_name), stats.browsers.map(b => b.count), browserChart, (c) => browserChart = c);
    createOrUpdateChart('deviceChart', stats.devices.map(d => d.device_type), stats.devices.map(d => d.count), deviceChart, (c) => deviceChart = c);

  } catch (err) {
    console.error('Stats load error:', err);
  }
}

async function loadVisitors() {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: limit,
      search: document.getElementById('searchInput').value,
      country: document.getElementById('countryFilter').value,
      city: document.getElementById('cityFilter').value,
      start_date: document.getElementById('startDate').value,
      end_date: document.getElementById('endDate').value
    });

    const data = await fetchJSON(`/api/visitors?${params.toString()}`);
    const tbody = document.querySelector('#visitorsTable tbody');
    tbody.innerHTML = '';
    data.data.forEach(visitor => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${visitor.id}</td>
        <td>${new Date(visitor.timestamp).toLocaleString()}</td>
        <td>${visitor.ip || ''}</td>
        <td>${visitor.country || ''}</td>
        <td>${visitor.region || ''}</td>
        <td>${visitor.city || ''}</td>
        <td>${visitor.browser_name} ${visitor.browser_version}</td>
        <td>${visitor.os}</td>
        <td>${visitor.device_type}</td>
        <td>${visitor.is_returning ? 'Yes (#' + visitor.visit_number + ')' : 'No'}</td>
        <td><button class="action-btn" data-id="${visitor.id}">Delete</button></td>
      `;
      tbody.appendChild(row);
    });

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this visitor record?')) {
          await fetch(`/api/visitor/${id}`, { method: 'DELETE' });
          loadVisitors();
        }
      });
    });

    const totalPages = Math.ceil(data.total / limit) || 1;
    document.getElementById('pageInfo').textContent = `Page ${data.page} of ${totalPages}`;
    document.getElementById('prevPage').disabled = data.page <= 1;
    document.getElementById('nextPage').disabled = data.page >= totalPages;

  } catch (err) {
    console.error('Visitors load error:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStatsAndCharts();
  loadVisitors();
  setInterval(loadStatsAndCharts, 5000);
  setInterval(loadVisitors, 5000);

  document.getElementById('applyFilters').addEventListener('click', () => {
    currentPage = 1;
    loadVisitors();
  });
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadVisitors(); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++; loadVisitors();
  });
  document.getElementById('exportCSV').addEventListener('click', () => {
    window.open('/api/export?format=csv', '_blank');
  });
  document.getElementById('exportJSON').addEventListener('click', () => {
    window.open('/api/export?format=json', '_blank');
  });
});