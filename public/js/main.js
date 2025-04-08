// --- Helper: Authenticated fetch wrapper ---
function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { headers, ...options });
}

function showSection(sectionId) {
  // Hide all sections
  const sections = document.querySelectorAll('section');
  sections.forEach(section => section.classList.add('hidden'));

  // Show the specified section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  } else {
    console.error(`Section with ID "${sectionId}" not found.`);
  }
}

// --- Authentication ---
async function register(email, name, password) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password })
  });
  if (!res.ok) throw new Error('Registration failed');
  
  alert('Registered! Please log in.');
}

async function login(loginEmail, password) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginEmail, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    alert("Logged in successfully!");
    loadPortfolios();
    showSection('portfolioSection');
  } else {
    alert(data.error || 'Login failed');
  }
}

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await register(
      document.getElementById('regEmail').value,
      document.getElementById('regName').value,
      document.getElementById('regPassword').value
    );
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  await login(
    document.getElementById('loginEmail').value,
    document.getElementById('loginPassword').value
  );
});

// --- Portfolio ---
let currentPortfolioId;

async function loadPortfolios() {
  // Fetch all portfolios for the logged-in user
  const res = await apiFetch('/api/portfolios');
  const portfolios = await res.json();

  const container = document.getElementById('portfoliosContainer');
  container.innerHTML = ''; // Clear existing content

  for (const portfolio of portfolios) {
    const portfolioDiv = document.createElement('div');
    portfolioDiv.className = 'portfolio';
    const money = portfolio.money ? parseFloat(portfolio.money) : 0;

    // Portfolio header
    portfolioDiv.innerHTML = `
        <h3>Portfolio: ${portfolio.name}</h3>
        <p>Cash: $${money.toFixed(2)}</p>
        <button onclick="depositCash(${portfolio.pid})">Deposit Cash</button>
        <button onclick="withdrawCash(${portfolio.pid}, ${money})">Withdraw Cash</button>
        <h4>Owned Stocks</h4>
        <table>
          <thead>
            <tr>
              <th>Stock Symbol</th>
              <th>Shares</th>
              <th>Last Close Price</th>
              <th>Market Value</th>
            </tr>
          </thead>
          <tbody id="holdings-${portfolio.pid}">
            <!-- Stock holdings will be dynamically populated -->
          </tbody>
        </table>
      `;

    container.appendChild(portfolioDiv);

    // Load holdings for this portfolio
    loadHoldings(portfolio.pid);
  }
}

document.getElementById('createPortfolioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const portfolioName = document.getElementById('portfolioName').value;

  try {
    // Send a request to create a new portfolio
    await apiFetch('/api/portfolios/new', {
      method: 'POST',
      body: JSON.stringify({ name: portfolioName }),
    });

    // Clear the input field
    document.getElementById('portfolioName').value = '';

    // Reload portfolios
    loadPortfolios();
  } catch (err) {
    alert('Failed to create portfolio: ' + err.message);
  }
});

async function loadHoldings(pid) {
  const res = await apiFetch(`/api/portfolios/${pid}`);
  const { holdings } = await res.json();

  const tbody = document.getElementById(`holdings-${pid}`);
  tbody.innerHTML = ''; // Clear existing rows

  for (const holding of holdings) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${holding.stock}</td>
        <td>${holding.shares}</td>
        <td>$${holding.close.toFixed(2)}</td>
        <td>$${(holding.shares * holding.close).toFixed(2)}</td>
      `;
    tbody.appendChild(row);
  }
}

async function renderPortfolio(pid) {
  // cash
  const cashRes = await apiFetch(`/api/portfolios/${pid}`);
  const { money, holdings } = await cashRes.json();
  document.getElementById('cashAccount').textContent = `$${money.toFixed(2)}`;

  // holdings table
  const tbody = document.querySelector('#holdingsTable tbody');
  tbody.innerHTML = '';
  for (let h of holdings) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${h.stock}</td>
        <td>${h.shares}</td>
        <td>$${h.close.toFixed(2)}</td>
        <td>$${(h.shares * h.close).toFixed(2)}</td>
      `;
    tbody.appendChild(row);
  }
}

async function depositCash(pid) {
  const amt = prompt('Amount to deposit:');
  if (!amt) return;
  await apiFetch(`/api/portfolios/${pid}/deposit`, {
    method: 'POST',
    body: JSON.stringify({ amount: parseFloat(amt) }),
  });
  loadPortfolios();
}

async function withdrawCash(pid, money) {
  const amt = prompt('Amount to withdraw:');
  if (!amt) return;
  if (amt > money) {
    alert('Insufficient funds!');
    return;
  }
  await apiFetch(`/api/portfolios/${pid}/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ amount: parseFloat(amt) }),
  });
  loadPortfolios();
}

// Call `loadPortfolios` when the portfolio section is shown
document.querySelector('a[onclick="showSection(\'portfolioSection\')"]').addEventListener('click', loadPortfolios);

// --- Predictions ---
async function predictStock(stock, interval) {
  const res = await apiFetch(`/api/predictions?stock=${stock}&days=${interval}`);
  return res.json();
}

document.getElementById('predictionForm').addEventListener('submit', async e => {
  e.preventDefault();
  const stock = document.getElementById('predictStock').value;
  const days = parseInt(document.getElementById('predictInterval').value, 10);
  const data = await predictStock(stock, days);
  drawPredictionChart(data.labels, data.prices);
});

function drawPredictionChart(labels, data) {
  const ctx = document.getElementById('predictionChart').getContext('2d');
  new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Predicted Price', data, borderColor: 'green', fill: false }] }, options: { responsive: true } });
}

// --- Initialization ---
window.onload = () => {
  showSection('loginSection');
  // after login
};