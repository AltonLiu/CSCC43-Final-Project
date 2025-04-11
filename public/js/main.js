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
  if (!res.ok) throw new Error('Registration failed: ' + (await res.json()).error);
  
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
  const res = await apiFetch('/api/portfolios');
  const portfolios = await res.json();

  const container = document.getElementById('portfoliosContainer');
  container.innerHTML = ''; // Clear existing content

  for (const portfolio of portfolios) {
    const portfolioDiv = document.createElement('div');
    portfolioDiv.className = 'portfolio';
    portfolioDiv.setAttribute('data-pid', portfolio.pid);

    portfolioDiv.innerHTML = `
      <h3>Portfolio: ${portfolio.name}</h3>
      <p class="cash-value">Cash: $0.00</p>
      <p class="stock-value">Total Stock Value: $0.00</p>
      <button onclick="depositCash(${portfolio.pid})">Deposit Cash</button>
      <button onclick="withdrawCash(${portfolio.pid})">Withdraw Cash</button>
      <button onclick="buyStock(${portfolio.pid})">Buy Stocks</button>
      <button onclick="sellStock(${portfolio.pid})">Sell Stocks</button>
      <button onclick="viewTransactions(${portfolio.pid})">Transactions</button>
      <button onclick="deletePortfolio(${portfolio.pid})" style="color: red;">Delete Portfolio</button>
      <h4>Owned Stocks</h4>
      <table>
        <thead>
          <tr>
            <th>Stock Symbol</th>
            <th>Shares</th>
            <th>Last Close Price</th>
            <th>Market Value</th>
            <th>Coefficient of Variation</th>
            <th>Beta</th>
          </tr>
        </thead>
        <tbody id="holdings-${portfolio.pid}">
          <!-- Stock holdings will be dynamically populated -->
        </tbody>
      </table>
      <div id="correlation-${portfolio.pid}">
        <!-- Correlation matrix will be dynamically populated -->
      </div>
    `;

    container.appendChild(portfolioDiv);

    // Load holdings for this portfolio
    loadHoldings(portfolio.pid);
  }

  populateTransferDropdowns();
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

async function deletePortfolio(pid) {
  if (!confirm('Are you sure you want to delete this portfolio? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await apiFetch(`/api/portfolios/${pid}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete portfolio');
    }

    alert('Portfolio deleted successfully! Your cash has been withdrawn to your bank account');
    loadPortfolios(); // Reload portfolios to reflect changes
  } catch (err) {
    alert('Failed to delete portfolio: ' + err.message);
  }
}

async function loadHoldings(pid) {
  const res = await apiFetch(`/api/portfolios/${pid}`);
  const { holdings, money, totalStockValue, correlationMatrix } = await res.json();

  // Update the cash and total stock value
  const portfolioDiv = document.querySelector(`.portfolio[data-pid="${pid}"]`);
  if (portfolioDiv) {
    portfolioDiv.querySelector('.cash-value').textContent = `Cash: $${money.toFixed(2)}`;
    portfolioDiv.querySelector('.stock-value').textContent = `Total Stock Value: $${totalStockValue.toFixed(2)}`;
  }

  // Populate the holdings table
  const tbody = document.getElementById(`holdings-${pid}`);
  tbody.innerHTML = ''; // Clear existing rows

  for (const holding of holdings) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><a href="#" onclick="showStockHistory('${holding.stock}')">${holding.stock}</a></td>
      <td>${holding.shares}</td>
      <td>$${holding.close.toFixed(2)}</td>
      <td>$${(holding.shares * holding.close).toFixed(2)}</td>
      <td>${holding.coefficient_of_variation ? holding.coefficient_of_variation.toFixed(4) : 'N/A'}</td>
      <td>${holding.beta ? holding.beta.toFixed(4) : 'N/A'}</td>
    `;
    tbody.appendChild(row);
  }

  // Display the correlation matrix
  const correlationDiv = document.getElementById(`correlation-${pid}`);
  correlationDiv.innerHTML = '<h4>Correlation Matrix</h4>';
  correlationMatrix.forEach(correlation => {
    const p = document.createElement('p');
    p.textContent = `${correlation.stock1} ↔ ${correlation.stock2}: ${correlation.correlation.toFixed(4)}`;
    correlationDiv.appendChild(p);
  });
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

async function withdrawCash(pid) {
  const amt = prompt('Amount to withdraw:');
  if (!amt) return;

  try {
    const res = await apiFetch(`/api/portfolios/${pid}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amt) }),
    });

    // Check if the response status is not 200
    if (!res.ok) {
      const errorData = await res.json(); // Parse the error response
      throw new Error(errorData.error || 'Failed to withdraw cash');
    }

    loadPortfolios(); // Reload portfolios to reflect changes
    alert('Withdrawal successful!');
  } catch (err) {
    alert('Failed to withdraw cash: ' + err.message); // Show an alert with the error message
  }
}

// Populate the transfer dropdowns with portfolio options
async function populateTransferDropdowns() {
  console.log('Populating transfer dropdowns...');
  const res = await apiFetch('/api/portfolios');
  const portfolios = await res.json();
  console.log('Portfolios:', portfolios);

  const fromSelect = document.getElementById('fromPortfolio');
  const toSelect = document.getElementById('toPortfolio');

  fromSelect.innerHTML = ''; // Clear existing options
  toSelect.innerHTML = ''; // Clear existing options

  for (const portfolio of portfolios) {
    const option = document.createElement('option');
    option.value = portfolio.pid;
    option.textContent = portfolio.name;

    fromSelect.appendChild(option);
    toSelect.appendChild(option.cloneNode(true)); // Clone the option for the "to" dropdown
  }
}

// Handle transfer form submission
document.getElementById('transferFundsForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fromPid = document.getElementById('fromPortfolio').value;
  const toPid = document.getElementById('toPortfolio').value;
  const amount = parseFloat(document.getElementById('transferAmount').value);

  if (fromPid === toPid) {
    alert('Cannot transfer funds to the same portfolio.');
    return;
  }

  try {
    // Send a request to transfer funds
    await apiFetch('/api/portfolios/transfer', {
      method: 'POST',
      body: JSON.stringify({ fromPid, toPid, amount }),
    });

    loadPortfolios(); // Reload portfolios to reflect changes
  } catch (err) {
    alert('Failed to transfer funds: ' + err.message);
  }
});

// Call `loadPortfolios` when the portfolio section is shown
document.querySelector('a[onclick="showSection(\'portfolioSection\')"]').addEventListener('click', loadPortfolios);

async function buyStock(pid) {
  const stock = prompt('Enter the stock symbol to buy:');
  const shares = parseInt(prompt('Enter the number of shares to buy:'), 10);

  if (!stock || isNaN(shares) || shares <= 0) {
    alert('Invalid input');
    return;
  }

  try {
    const res = await apiFetch(`/api/portfolios/${pid}/buy`, {
      method: 'POST',
      body: JSON.stringify({ stock, shares }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to buy stock');
    }

    alert('Stock purchased successfully!');
    loadPortfolios(); // Reload portfolios to reflect changes
  } catch (err) {
    alert('Failed to buy stock: ' + err.message);
  }
}

async function sellStock(pid) {
  const stock = prompt('Enter the stock symbol to sell:');
  const shares = parseInt(prompt('Enter the number of shares to sell:'), 10);

  if (!stock || isNaN(shares) || shares <= 0) {
    alert('Invalid input');
    return;
  }

  try {
    const res = await apiFetch(`/api/portfolios/${pid}/sell`, {
      method: 'POST',
      body: JSON.stringify({ stock, shares }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to sell stock');
    }

    const data = await res.json();
    alert(`Stock sold successfully! Cash added: $${data.cashAdded.toFixed(2)}`);
    loadPortfolios(); // Reload portfolios to reflect changes
  } catch (err) {
    alert('Failed to sell stock: ' + err.message);
  }
}

// Function to fetch and display the stock's historical performance
async function showStockHistory(stock, range = 'all') {
  try {
    currentStock = stock; // Store the current stock symbol
    const res = await apiFetch(`/api/stocks/${stock}/history`);
    const history = await res.json();

    // Determine the latest date from the history data
    const latestDate = new Date(Math.max(...history.map(entry => new Date(entry.date))));

    // Filter the data based on the selected range
    let filteredHistory = history;

    if (range === 'year') {
      filteredHistory = history.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= new Date(latestDate.getFullYear() - 1, latestDate.getMonth(), latestDate.getDate());
      });
    } else if (range === 'month') {
      filteredHistory = history.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= new Date(latestDate.getFullYear(), latestDate.getMonth() - 1, latestDate.getDate());
      });
    } else if (range === 'week') {
      filteredHistory = history.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() - 7);
      });
    }

    // Extract and format data for the graph
    const labels = filteredHistory.map(entry => new Date(entry.date).toLocaleDateString()); // Format dates
    const prices = filteredHistory.map(entry => entry.close);

    // Render the graph
    renderStockGraph(stock, labels, prices);
  } catch (err) {
    alert('Failed to fetch stock history: ' + err.message);
  }
}

async function updateStockHistory(range) {
    if (currentStock) {
        await showStockHistory(currentStock, range);
    }
}

let currentStock = null; // Track the currently selected stock

async function fetchPredictions(stock, range) {
  const res = await apiFetch('/api/stocks/predict', {
    method: 'POST',
    body: JSON.stringify({ stock, range }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch predictions');
  }
  return res.json();
}

async function showStockPredictions(stock, range) {
  try {
    // Fetch predictions
    const predictions = await fetchPredictions(stock, range);

    // Extract prediction data
    const predictionLabels = predictions.predictions.map(p => new Date(p.date).toLocaleDateString());
    const predictionPrices = predictions.predictions.map(p => parseFloat(p.price));

    // Render the graph with predictions
    renderStockGraph(stock, predictionLabels, predictionPrices, `Predicted Performance (${range})`);
  } catch (err) {
    alert('Failed to fetch predictions: ' + err.message);
  }
}

let currentChart = null; // Variable to store the current chart instance

// Function to render the stock graph
function renderStockGraph(stock, labels, prices, label = 'Historical Performance') {
  const dialog = document.getElementById('stockGraphDialog');
  const canvas = document.getElementById('stockGraphCanvas');

  // Destroy the existing chart if it exists
  if (currentChart) {
    currentChart.destroy();
  }

  // Create a new chart
  currentChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${label} of ${stock}`,
        data: prices,
        borderColor: label.includes('Predicted') ? 'red' : 'blue',
        borderDash: label.includes('Predicted') ? [5, 5] : [],
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { title: { display: true, text: 'Date' } },
        y: { title: { display: true, text: 'Price ($)' } },
      },
      plugins: {
        legend: {
          position: 'top',
        },
      },
    },
  });

  // Show the dialog
  dialog.showModal();
}

async function viewTransactions(pid) {
  const res = await apiFetch(`/api/portfolios/${pid}/transactions`);
  const { cashTransactions, stockTransactions } = await res.json();

  let transactionsHtml = '<h4>Cash Transactions</h4><ul>';
  for (const tx of cashTransactions) {
    transactionsHtml += `<li> $${tx.amount.toFixed(2)} (Source: ${tx.source}, Destination: ${tx.destination})</li>`;
  }
  transactionsHtml += '</ul><h4>Stock Transactions</h4><ul>';
  for (const tx of stockTransactions) {
    transactionsHtml += `<li>${tx.stock}: ${tx.shares} shares</li>`;
  }
  transactionsHtml += '</ul>';

  const transactionsContent = document.getElementById('transactionsContent');
  transactionsContent.innerHTML = transactionsHtml;

  const transactionsDialog = document.getElementById('transactionsDialog');
  transactionsDialog.showModal(); // Open the dialog
}

document.getElementById('addStockForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const inputSymbol = document.getElementById('inputSymbol').value;
  const stockDate = document.getElementById('stockDate').value;
  const stockOpen = parseFloat(document.getElementById('stockOpen').value);
  const stockHigh = parseFloat(document.getElementById('stockHigh').value);
  const stockLow = parseFloat(document.getElementById('stockLow').value);
  const stockClose = parseFloat(document.getElementById('stockClose').value);
  const stockVolume = parseInt(document.getElementById('stockVolume').value, 10);

  try {
    // Send the stock data to the backend
    await apiFetch('/api/stocks/new', {
      method: 'POST',
      body: JSON.stringify({
        symbol: inputSymbol,
        date: stockDate,
        open: stockOpen,
        high: stockHigh,
        low: stockLow,
        close: stockClose,
        volume: stockVolume,
      }),
    });

    alert('Stock data added successfully!');
    document.getElementById('addStockForm').reset(); // Clear the form
  } catch (err) {
    alert('Failed to add stock data: ' + err.message);
  }
});

// --- Initialization ---
window.onload = () => {
  showSection('loginSection');
  // after login
};