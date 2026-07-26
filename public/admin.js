/**
 * Admin dashboard logic.
 * - Fetches stats and visitor list every 5 seconds.
 * - Renders charts (countries, cities, browsers, devices).
 * - Handles pagination, search, filters, delete, export.
 */

// ---------- Store chart instances globally ----------
let countryChart, cityChart, browserChart, deviceChart;
let currentPage = 1;
const limit = 20;

// ---------- Utility: fetch API helper ----------
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Destroy existing chart if present (to allow type changes) ----------
function destroyChart(chart) {
  if (chart && typeof chart.destroy === 'function') {
    chart.destroy();
  }
}

// ---------- Render or update a chart ----------
function renderChart(canvasId, dataArray, labelKey, valueKey, existingChart, setChartRef) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas #${canvasId} not found`);
    return;
  }

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded. Charts will not be displayed.');
    return;
  }

  const ctx = canvas.getContext('2d');
  const labels = dataArray.map(item => item[labelKey] || 'Unknown');
  const values = dataArray.map(item => item[valueKey]);

  // Determine chart type: pie for ≤6 items, bar otherwise
  const type = labels.length <= 6 ? 'pie' : 'bar';

  // Destroy previous chart instance if exists
  destroyChart(existingChart);

  const newChart = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        label: 'Visitors',
        data: values,
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
        y: {
          beginAtZero: true,
          ticks: { color: '#e2e8f0' }
        },
        x: {
          ticks: { color: '#e2e8f0' }
        }
      } : {}
    }
  });

  setChartRef(newChart);
}

// ---------- Fetch stats and update cards + charts ----------
async function loadStatsAndCharts() {
  try {
    const stats = await fetchJSON('/api/stats');  // ← relative (works on all environments)

    // Update cards
    document.getElementById('totalVisitors').textContent = stats.totalVisitors;
    document.getElementById('todayVisitors').textContent = stats.todayVisitors;
    document.getElementById('onlineVisitors').textContent = stats.onlineVisitors;

    // Update filter dropdowns
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

    // Render/update charts
    renderChart('countryChart', stats.countries, 'country', 'count', countryChart, (chart) => { countryChart = chart; });
    renderChart('cityChart', stats.cities, 'city', 'count', cityChart, (chart) => { cityChart = chart; });
    renderChart('browserChart', stats.browsers, 'browser_name', 'count', browserChart, (chart) => { browserChart = chart; });
    renderChart('deviceChart', stats.devices, 'device_type', 'count', deviceChart, (chart) => { deviceChart = chart; });

  } catch (err) {
    console.error('Stats load error:', err);
  }
}

// ---------- Load visitors table with filters/pagination ----------
async function loadVisitors() {
  try {
    const search = document.getElementById('searchInput').value;
    const country = document.getElementById('countryFilter').value;
    const city = document.getElementById('cityFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    const params = new URLSearchParams({
      page: currentPage,
      limit: limit,
      search: search,
      country: country,
      city: city,
      start_date: startDate,
      end_date: endDate
    });

    const data = await fetchJSON(`/api/visitors?${params.toString()}`);  // ← relative

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

    // Attach delete events
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this visitor record?')) {
          await fetch(`/api/visitor/${id}`, { method: 'DELETE' });  // ← relative
          loadVisitors();
        }
      });
    });

    // Pagination info
    const totalPages = Math.ceil(data.total / limit) || 1;
    document.getElementById('pageInfo').textContent = `Page ${data.page} of ${totalPages}`;
    document.getElementById('prevPage').disabled = data.page <= 1;
    document.getElementById('nextPage').disabled = data.page >= totalPages;

  } catch (err) {
    console.error('Visitors load error:', err);
  }
}

// ---------- Initial load and intervals ----------
document.addEventListener('DOMContentLoaded', () => {
  loadStatsAndCharts();
  loadVisitors();

  // Auto-refresh every 5 seconds
  setInterval(loadStatsAndCharts, 5000);
  setInterval(loadVisitors, 5000);

  // Filter / search button
  document.getElementById('applyFilters').addEventListener('click', () => {
    currentPage = 1;
    loadVisitors();
  });

  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadVisitors();
    }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    loadVisitors();
  });

  // Export buttons
  document.getElementById('exportCSV').addEventListener('click', () => {
    window.open('/api/export?format=csv', '_blank');   // ← relative
  });
  document.getElementById('exportJSON').addEventListener('click', () => {
    window.open('/api/export?format=json', '_blank');  // ← relative
  });
});