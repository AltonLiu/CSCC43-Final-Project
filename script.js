// Function to toggle visibility of sections
function showSection(sectionId) {
    const sections = document.querySelectorAll('section');
    sections.forEach(sec => sec.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
  }

  // Dummy event listeners for login and registration
  document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Logged in successfully!");
    showSection('portfolioSection');
  });
  document.getElementById("registerForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Registration successful! Please log in.");
  });

  // Dummy event listeners for friend request form
  document.getElementById("friendRequestForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Friend request sent to " + document.getElementById("friendEmail").value);
  });

  // Process friend request accept/reject
  function processRequest(button, action) {
    const li = button.parentElement;
    alert("Request " + action + "ed for " + li.textContent.split(" ")[0]);
    li.remove();
  }
  function removeFriend(button) {
    const li = button.parentElement;
    alert("Removed friend: " + li.textContent.split(" ")[0]);
    li.remove();
  }

  // Dummy deposit and withdraw actions
  function depositCash() {
    alert("Deposit cash function triggered");
  }
  function withdrawCash() {
    alert("Withdraw cash function triggered");
  }

  // Handle stock list submission
  document.getElementById("stockListForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Stock added to list: " + document.getElementById("stockSymbol").value);
  });

  // Handle review submission
  document.getElementById("reviewForm").addEventListener("submit", function(e) {
    e.preventDefault();
    alert("Review submitted for " + document.getElementById("reviewList").value);
  });

  // Handle prediction form submission and draw dummy chart
  document.getElementById("predictionForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const stock = document.getElementById("predictStock").value;
    const interval = document.getElementById("predictInterval").value;
    alert("Predicting future prices for " + stock + " over " + interval + " days.");
    drawPredictionChart();
  });

  // Draw dummy historical chart on portfolio page
  function drawHistoricalChart() {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Day 1','Day 2','Day 3','Day 4','Day 5'],
        datasets: [{
          label: 'AAPL Close Price',
          data: [150, 152, 148, 155, 157],
          borderColor: 'blue',
          fill: false
        }]
      },
      options: {
        responsive: true
      }
    });
  }

  // Draw dummy prediction chart on predictions section
  function drawPredictionChart() {
    const ctx = document.getElementById('predictionChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Day 1','Day 2','Day 3','Day 4','Day 5'],
        datasets: [{
          label: 'Predicted AAPL Price',
          data: [157, 158, 160, 162, 165],
          borderColor: 'green',
          fill: false
        }]
      },
      options: {
        responsive: true
      }
    });
  }

  // Initialize historical chart on page load (if portfolio section is visible)
  window.onload = function() {
    drawHistoricalChart();
  }