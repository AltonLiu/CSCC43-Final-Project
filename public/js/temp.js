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
      ${
        visibility === 'private'
          ? `<button onclick="deleteStockList(${list.lid})" style="color: red;">Delete</button>`
          : ''
      }
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

  await pool.query(
    `SELECT sl.*
     FROM stocklists sl
     JOIN stocklistsharedwith sw ON sl.lid = sw.lid
     WHERE sw.uid = $1`,
    [userId]
);