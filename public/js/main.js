// --- Helper: Authenticated fetch wrapper ---
function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { headers, ...options });
}

function showSection(sectionId) {
  if (sectionId === "friendsSection")
    updateFriends();
  else if (sectionId === "stockListSection")
    loadStockLists();
  else if (sectionId === "portfolioSection")
    loadPortfolios();

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

// --- Friends ---
async function requestFriend() {
  const email = document.getElementById("friendEmail").value;
  const res = await apiFetch('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  if (res.ok) {
    alert("Friend request sent!");
  } else {
    const errorData = await res.json();
    alert("Error: " + (errorData.error || "Failed to send friend request"));
  }

  updateFriends();
}

async function processRequest(e, action) {
  const email = e.parentElement.dataset.user;
  await apiFetch('/api/friends/manage', {
    method: 'POST',
    body: JSON.stringify({ email, action })
  });
  updateFriends();
}

async function removeFriend(e) {
  const email = e.parentElement.dataset.user;
  await apiFetch('/api/friends', {
    method: 'DELETE',
    body: JSON.stringify({ email })
  });
  updateFriends();
}

async function updateFriends() {
  const inRequests = await (await apiFetch("/api/friends/requests/in")).json();
  const domInRequests = document.getElementById("incomingRequests");
  domInRequests.innerHTML = "";
  for (const row of inRequests) {
    const item = document.createElement("li");
    item.innerHTML = `${row.sender} <button onclick="processRequest(this, 'accept')">Accept</button> <button onclick="processRequest(this, 'reject')">Reject</button>`;
    item.dataset.user = row.sender;
    domInRequests.appendChild(item);
  }

  const outRequests = await (await apiFetch("/api/friends/requests/out")).json();
  const domOutRequests = document.getElementById("outgoingRequests");
  domOutRequests.innerHTML = "";
  for (const row of outRequests) {
    const item = document.createElement("li");
    item.innerHTML = row.receiver;
    item.dataset.user = row.receiver;
    domOutRequests.appendChild(item);
  }

  const friends = await (await apiFetch("/api/friends")).json();
  const domFriends = document.getElementById("friendList");
  domFriends.innerHTML = "";
  for (const row of friends) {
    const item = document.createElement("li");
    item.innerHTML = `${row.friend} <button onclick="removeFriend(this)">Remove</button>`;
    item.dataset.user = row.friend;
    domFriends.appendChild(item);
  }
}

// --- Stock Lists ---
async function loadStockLists() {
  const res = await apiFetch('/api/stocklists');
  const { privateLists, sharedLists, publicLists } = await res.json();
  console.log('Stock Lists:', privateLists, sharedLists, publicLists);

  // Populate Private Stock Lists
  const privateContainer = document.getElementById('privateStockLists');
  privateContainer.innerHTML = '';
  if (privateLists.length > 0) {
    for (const list of privateLists) {
      console.log('Rendering private list:', list);
      privateContainer.appendChild(renderStockList(list, 'private'));
    }
  } else {
    privateContainer.innerHTML = '<p>No private stock lists available.</p>';
  }

  // Populate Shared Stock Lists
  const sharedContainer = document.getElementById('sharedStockLists');
  sharedContainer.innerHTML = '';

  if (sharedLists.length > 0) {
    for (const list of sharedLists) {
      console.log('Rendering shared list:', list);
      sharedContainer.appendChild(renderStockList(list, 'shared'));
    }
  } else {
    sharedContainer.innerHTML = '<p>No shared stock lists available.</p>';
  }

  // Populate Public Stock Lists
  const publicContainer = document.getElementById('publicStockLists');
  publicContainer.innerHTML = '';
  if (publicLists.length > 0) {
    for (const list of publicLists) {
      console.log('Rendering public list:', list);
      publicContainer.appendChild(renderStockList(list, 'public'));
    }
  } else {
    publicContainer.innerHTML = '<p>No public stock lists available.</p>';
  }
}

// Render a stock list
function renderStockList(list, visibility) {
  const div = document.createElement('div');
  div.className = 'stock-list';
  div.innerHTML = `
    <h4>${list.name} <small>(${visibility})</small></h4>
    <button onclick="openAddStockDialog(${list.lid})">Add Stock</button>
    <button onclick="openShareStockDialog(${list.lid})">Share</button>
    <button onclick="toggleStockListVisibility(${list.lid}, '${visibility}')">
      ${visibility === 'public' ? 'Make Private' : 'Make Public'}
    </button>
    <button onclick="deleteStockList(${list.lid})" style="color: red;">Delete</button>
    <div>
        <h5>Stocks in List</h5>
        <table>
          <thead>
            <tr>
              <th>Stock Symbol</th>
              <th>Shares</th>
              <th>Coefficient of Variation</th>
              <th>Beta</th>
            </tr>
          </thead>
          <tbody id="stocks-${list.lid}">
            <!-- Stocks will be dynamically populated -->
          </tbody>
        </table>
      </div>
      <div id="correlation-${list.lid}">
        <!-- Correlation matrix will be dynamically populated -->
      </div>
  `;
  loadStockListDetails(list.lid);
  return div;
}

async function loadStockListDetails(listId) {
  console.log('Loading stock list details for ID:', listId);
  const res = await apiFetch(`/api/stocklists/${listId}`);
  const { stocks, correlationMatrix } = await res.json();

  // Populate the stocks table
  const tbody = document.getElementById(`stocks-${listId}`);
  tbody.innerHTML = ''; // Clear existing rows

  for (const stock of stocks) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${stock.symbol}</td>
      <td>${stock.shares}</td>
      <td>${stock.coefficient_of_variation ? stock.coefficient_of_variation.toFixed(4) : 'N/A'}</td>
      <td>${stock.beta ? stock.beta.toFixed(4) : 'N/A'}</td>
    `;
    tbody.appendChild(row);
  }

  // Populate the correlation matrix
  const correlationDiv = document.getElementById(`correlation-${listId}`);
  correlationDiv.innerHTML = '<h5>Correlation Matrix</h5>';
  correlationMatrix.forEach(correlation => {
    const p = document.createElement('p');
    p.textContent = `${correlation.stock1} ↔ ${correlation.stock2}: ${correlation.value.toFixed(4)}`;
    correlationDiv.appendChild(p);
  });
}

// Open the Add Stock dialog
function openAddStockDialog(stockListId) {
  currentStockListId = stockListId; // Store the current stock list ID
  const dialog = document.getElementById('addStockDialog');
  dialog.showModal();
}

// Add a stock to a stock list
async function addStockToList(e) {
  e.preventDefault();

  const stockSymbol = document.getElementById('stockSymbol').value;
  const shares = parseInt(document.getElementById('shares').value, 10);

  try {
    await apiFetch(`/api/stocklists/${currentStockListId}/add`, {
      method: 'POST',
      body: JSON.stringify({ stock: stockSymbol, shares }),
    });

    alert('Stock added successfully!');
    document.getElementById('addStockToListForm').reset();
    document.getElementById('addStockDialog').close();
    loadStockLists(); // Reload stock lists to reflect changes
  } catch (err) {
    alert('Failed to add stock: ' + err.message);
  }
}

// Create a new stock list
async function createStockList(e) {
  e.preventDefault();

  const name = document.getElementById('listName').value;

  try {
    const res = await apiFetch('/api/stocklists/new', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to create stock list');
    }

    alert('Stock list created successfully!');
    document.getElementById('createStockListForm').reset();
    loadStockLists();
  } catch (err) {
    alert('Failed to create stock list: ' + err.message);
  }
}

let currentStockListId = null;

function openShareStockDialog(stockListId) {
  currentStockListId = stockListId;
  const dialog = document.getElementById('shareStockDialog');
  dialog.showModal();
}

// Share a Stock List
document.getElementById('shareStockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Sharing stock list with ID:', currentStockListId);
  const email = document.getElementById('shareEmail').value;
  const res = await apiFetch(`/api/stocklists/${currentStockListId}/share`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    alert('Failed to share stock list: ' + (errorData.error || 'Unknown error'));
  } else {
    alert('Stock list shared successfully!');
    document.getElementById('shareStockForm').reset();
    document.getElementById('shareStockDialog').close();
    loadStockLists(); // Reload stock lists to reflect changes
  }
});

// Toggle Stock List Visibility
async function toggleStockListVisibility(stockListId, currentVisibility) {
  const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

  try {
    const res = await apiFetch(`/api/stocklists/${stockListId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ visibility: newVisibility }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to update visibility');
    }

    alert(`Stock list visibility set to ${newVisibility}!`);
    loadStockLists(); // Reload stock lists to reflect changes
  } catch (err) {
    alert('Failed to update stock list visibility: ' + err.message);
  }
}

async function deleteStockList(lid) {
  if (!confirm('Are you sure you want to delete this stock list? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await apiFetch(`/api/stocklists/${lid}/delete`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete stock list');
    }

    alert('Stock list deleted successfully!');
    loadStockLists(); // Reload stock lists to reflect changes
  } catch (err) {
    alert('Failed to delete stock list: ' + err.message);
  }
}

// Event Listeners
document.getElementById('createStockListForm').addEventListener('submit', createStockList);
document.getElementById('addStockToListForm').addEventListener('submit', addStockToList);

// --- Initialization ---
window.onload = () => {
  showSection('loginSection');
  // after login
};
