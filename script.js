document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';
    const SAVINGS_GOAL_KEY = 'savingsGoal'; // Key for localStorage
    const SAVINGS_CURRENT_KEY = 'currentSavings'; // Key for current savings in localStorage

    // --- Pagination Globals ---
    const ITEMS_PER_PAGE = 15;
    let currentTransactionsPage = 1;
    let currentSavingsPage = 1;
    let allTransactionsData = []; // Store all fetched data for consistent filtering and pagination
    let allSavingsDataGlobal = []; // Store all fetched savings data for pagination

    // --- Chart Globals ---
    let expenseChartInstance; // To hold the Chart.js instance

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            if (values.length !== headers.length) {
                console.warn('CSV Parse Warning: Skipping malformed row:', lines[i]);
                continue;
            }
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
        return data;
    }

    async function fetchCSVData() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            return parseCSV(csv);
        } catch (error) {
            console.error('Error fetching CSV:', error);
            return [];
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date)) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function formatCurrency(amount) {
        return `₱ ${parseFloat(amount).toFixed(2)}`;
    }

    // --- Navigation and Theme ---
    const mainMenuButton = document.getElementById('mainMenuButton');
    const mainMenuSidebar = document.getElementById('mainMenuSidebar');
    const closeSidebarButton = document.getElementById('closeSidebarButton');
    const nightModeToggle = document.getElementById('nightModeToggle');

    if (mainMenuButton) {
        mainMenuButton.addEventListener('click', () => {
            mainMenuSidebar.classList.add('open');
        });
    }

    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', () => {
            mainMenuSidebar.classList.remove('open');
        });
    }

    if (nightModeToggle) {
        nightModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            // Save preference to localStorage
            if (document.body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
            } else {
                localStorage.setItem('theme', 'light');
            }
            // Re-render chart to update colors
            if (document.getElementById('dashboard-page') && expenseChartInstance) {
                updateExpenseChart();
            }
        });
    }

    // Apply saved theme on load
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // --- Calculator Functionality ---
    const openCalculatorFab = document.getElementById('openCalculatorFab');
    const calculatorOverlay = document.getElementById('calculatorOverlay');
    const closeCalculatorButton = document.getElementById('closeCalculatorButton');
    const calculatorDisplay = document.getElementById('calculatorDisplay');
    const calculatorButtons = document.querySelector('.calculator-buttons');

    let currentInput = '0';
    let operator = null;
    let firstOperand = null;
    let waitingForSecondOperand = false;

    function updateCalculatorDisplay() {
        calculatorDisplay.value = currentInput;
    }

    function inputDigit(digit) {
        if (waitingForSecondOperand) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateCalculatorDisplay();
    }

    function inputDecimal() {
        if (!currentInput.includes('.')) {
            currentInput += '.';
        }
        updateCalculatorDisplay();
    }

    function handleOperator(nextOperator) {
        const inputValue = parseFloat(currentInput);

        if (operator && waitingForSecondOperand) {
            operator = nextOperator;
            return;
        }

        if (firstOperand === null) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            currentInput = String(result);
            firstOperand = result;
        }

        waitingForSecondOperand = true;
        operator = nextOperator;
        updateCalculatorDisplay();
    }

    const performCalculation = {
        '/': (firstOperand, secondOperand) => firstOperand / secondOperand,
        '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
        '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
        '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
        '=': (firstOperand, secondOperand) => secondOperand // For equals, just return the second operand
    };

    function resetCalculator() {
        currentInput = '0';
        operator = null;
        firstOperand = null;
        waitingForSecondOperand = false;
        updateCalculatorDisplay();
    }

    function backspace() {
        currentInput = currentInput.slice(0, -1);
        if (currentInput === '') {
            currentInput = '0';
        }
        updateCalculatorDisplay();
    }

    if (openCalculatorFab) {
        openCalculatorFab.addEventListener('click', () => {
            calculatorOverlay.classList.add('open');
            resetCalculator();
        });
    }

    if (closeCalculatorButton) {
        closeCalculatorButton.addEventListener('click', () => {
            calculatorOverlay.classList.remove('open');
        });
    }

    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) {
                return;
            }

            if (target.classList.contains('digit')) {
                inputDigit(target.textContent);
                return;
            }

            if (target.classList.contains('decimal')) {
                inputDecimal();
                return;
            }

            if (target.classList.contains('operator')) {
                handleOperator(target.dataset.action);
                return;
            }

            if (target.classList.contains('clear')) {
                resetCalculator();
                return;
            }

            if (target.classList.contains('backspace')) {
                backspace();
                return;
            }

            if (target.classList.contains('equals')) {
                handleOperator(target.dataset.action); // Process last operation
                operator = null; // Clear operator after equals
                waitingForSecondOperand = false;
                return;
            }
        });
    }

    // --- Dashboard Page Logic ---
    if (document.getElementById('dashboard-page')) {
        const expenseChartCtx = document.getElementById('expenseChart').getContext('2d');
        const netExpenseValue = document.getElementById('netExpenseValue');
        const foodPct = document.getElementById('foodPct');
        const medicinesPct = document.getElementById('medicinesPct');
        const shoppingPct = document.getElementById('shoppingPct');
        const miscPct = document.getElementById('miscPct');

        const remainingBalancePct = document.getElementById('remainingBalancePct');
        const remainingBalanceAmount = document.getElementById('remainingBalanceAmount');

        const savingsAmount = document.getElementById('savingsAmount');
        const maskSavingsButton = document.getElementById('maskSavingsButton');

        let isSavingsMasked = false; // State for masking savings

        // Filter elements
        const monthFilter = document.getElementById('monthFilter');
        const yearFilter = document.getElementById('yearFilter');

        function initializeExpenseChart() {
            expenseChartInstance = new Chart(expenseChartCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Food', 'Medicines', 'Shopping', 'Misc'],
                    datasets: [{
                        data: [0, 0, 0, 0], // Initial data
                        backgroundColor: [
                            'var(--accent-green)',
                            'var(--accent-red)',
                            'var(--accent-orange)',
                            'var(--accent-blue)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '80%', // Makes it a donut chart
                    plugins: {
                        legend: {
                            display: false // We'll create a custom legend
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((acc, current) => acc + current, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                    return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        function populateYearFilter() {
            const currentYear = new Date().getFullYear();
            // Assuming transactions data is fetched, find min/max years
            // For now, let's hardcode a range or base it on current year
            const startYear = 2020; // You can adjust this or make it dynamic from data
            yearFilter.innerHTML = '<option value="">All Years</option>'; // Add "All Years" option
            for (let year = currentYear; year >= startYear; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            }
        }

        function getFilteredTransactionsForDashboard(transactions) {
            const selectedMonth = monthFilter.value;
            const selectedYear = yearFilter.value;

            return transactions.filter(transaction => {
                const transactionDate = new Date(transaction.Date); // Assuming 'Date' is the column name
                const transactionMonth = transactionDate.getMonth().toString(); // 0-indexed
                const transactionYear = transactionDate.getFullYear().toString();

                const monthMatch = selectedMonth === "" || transactionMonth === selectedMonth;
                const yearMatch = selectedYear === "" || transactionYear === selectedYear;

                return monthMatch && yearMatch;
            });
        }


        function updateExpenseChart() {
            if (!expenseChartInstance) {
                initializeExpenseChart();
            }

            const filteredTransactions = getFilteredTransactionsForDashboard(allTransactionsData);

            let foodExpense = 0;
            let medicinesExpense = 0;
            let shoppingExpense = 0;
            let miscExpense = 0;
            let totalGains = 0;
            let totalExpenses = 0;

            filteredTransactions.forEach(transaction => {
                const amount = parseFloat(transaction.Amount);
                if (transaction.Type === 'expense') {
                    totalExpenses += amount;
                    switch (transaction.Category) {
                        case 'Food':
                            foodExpense += amount;
                            break;
                        case 'Medicines':
                            medicinesExpense += amount;
                            break;
                        case 'Shopping':
                            shoppingExpense += amount;
                            break;
                        case 'Misc':
                            miscExpense += amount;
                            break;
                    }
                } else if (transaction.Type === 'income') {
                    totalGains += amount;
                }
            });

            const netExpense = totalGains - totalExpenses;
            netExpenseValue.textContent = formatCurrency(netExpense);

            const totalCategoryExpense = foodExpense + medicinesExpense + shoppingExpense + miscExpense;

            // Update chart data
            expenseChartInstance.data.datasets[0].data = [foodExpense, medicinesExpense, shoppingExpense, miscExpense];

            // Update legend percentages
            foodPct.textContent = `${((foodExpense / totalCategoryExpense) * 100 || 0).toFixed(0)}%`;
            medicinesPct.textContent = `${((medicinesExpense / totalCategoryExpense) * 100 || 0).toFixed(0)}%`;
            shoppingPct.textContent = `${((shoppingExpense / totalCategoryExpense) * 100 || 0).toFixed(0)}%`;
            miscPct.textContent = `${((miscExpense / totalCategoryExpense) * 100 || 0).toFixed(0)}%`;

            // Update summary info cards
            document.getElementById('totalExpensesAmount').textContent = formatCurrency(totalExpenses);
            document.getElementById('totalGainsAmount').textContent = formatCurrency(totalGains);


            // Update chart colors based on theme
            const isDarkMode = document.body.classList.contains('dark-mode');
            expenseChartInstance.data.datasets[0].backgroundColor = [
                isDarkMode ? '#4CAF50' : '#4CAF50', // Food
                isDarkMode ? '#F44336' : '#F44336', // Medicines
                isDarkMode ? '#FF9800' : '#FF9800', // Shopping
                isDarkMode ? '#2196F3' : '#2196F3'  // Misc
            ];

            expenseChartInstance.update();
        }

        function updateLimitCard() {
            // This is placeholder logic. You'll need to fetch and calculate actual limit and balance.
            const totalIncome = allTransactionsData
                .filter(t => t.Type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.Amount), 0);

            const totalExpenses = allTransactionsData
                .filter(t => t.Type === 'expense')
                .reduce((sum, t) => sum + parseFloat(t.Amount), 0);

            // Assuming 'limit' is based on income or a predefined value
            const dailyLimit = 1000; // Example daily limit
            const currentBalance = totalIncome - totalExpenses; // Simplified balance

            // For a more meaningful "remaining balance" in a daily context,
            // you'd need to filter transactions for the current period (e.g., today)
            // and have a defined budget/limit.

            // Placeholder: Let's assume remaining balance is income - expenses for the whole period.
            // Or, if you have a monthly budget, remaining = budget - monthly expenses.
            const budget = 50000; // Example monthly budget
            const expensesThisMonth = getFilteredTransactionsForDashboard(allTransactionsData) // Use filtered if you want it context-aware
                                      .filter(t => t.Type === 'expense' && new Date(t.Date).getMonth() === new Date().getMonth())
                                      .reduce((sum, t) => sum + parseFloat(t.Amount), 0);

            const remaining = budget - expensesThisMonth;
            const percentageRemaining = (remaining / budget) * 100;

            remainingBalanceAmount.textContent = `${formatCurrency(remaining)} of ${formatCurrency(budget)}`;
            remainingBalancePct.textContent = `${Math.max(0, percentageRemaining).toFixed(0)}%`; // Don't show negative percentage

            const circle = document.querySelector('.progress-ring-progress');
            const radius = circle.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;

            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            const offset = circumference - (percentageRemaining / 100) * circumference;
            circle.style.strokeDashoffset = offset;

            // Change color based on percentage
            if (percentageRemaining > 50) {
                circle.style.stroke = 'var(--accent-green)'; // High remaining: green
            } else if (percentageRemaining > 20) {
                circle.style.stroke = 'var(--accent-orange)'; // Medium remaining: orange
            } else {
                circle.style.stroke = 'var(--accent-red)'; // Low remaining: red
            }
        }


        function updateSavingsDisplay() {
            let currentSavings = parseFloat(localStorage.getItem(SAVINGS_CURRENT_KEY)) || 0;
            if (isSavingsMasked) {
                savingsAmount.textContent = '****';
            } else {
                savingsAmount.textContent = formatCurrency(currentSavings);
            }
        }

        if (maskSavingsButton) {
            maskSavingsButton.addEventListener('click', () => {
                isSavingsMasked = !isSavingsMasked;
                maskSavingsButton.textContent = isSavingsMasked ? 'Unmask' : 'Mask';
                updateSavingsDisplay();
            });
        }

        // Initial calls for dashboard
        fetchCSVData().then(data => {
            allTransactionsData = data;
            initializeExpenseChart();
            populateYearFilter(); // Populate year filter after data is available
            updateExpenseChart(); // Initial chart render with all data
            updateLimitCard();
            updateSavingsDisplay();
        });

        // Add event listeners for filters
        monthFilter.addEventListener('change', updateExpenseChart);
        yearFilter.addEventListener('change', updateExpenseChart);


    } else if (document.getElementById('transactions-page')) {
        const transactionsList = document.getElementById('transactionsList');
        const paginationControls = document.getElementById('paginationControls');
        const prevPageButton = document.getElementById('prevPage');
        const nextPageButton = document.getElementById('nextPage');
        const pageNumbersDiv = document.getElementById('pageNumbers');
        const transactionFilterButton = document.getElementById('transactionFilterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const applyFiltersButton = document.getElementById('applyFilters');
        const clearFiltersButton = document.getElementById('clearFilters');
        const categoryFilterDropdown = document.getElementById('categoryFilter');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const monthButtons = document.querySelectorAll('.months-nav .month-button');


        let filteredTransactions = []; // To store currently filtered transactions for pagination

        function renderTransactions(month = null) {
            let dataToRender = allTransactionsData;

            // Apply filters from dropdowns if they are open
            if (filterOptionsContainer && filterOptionsContainer.style.display === 'flex') {
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
                const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

                dataToRender = dataToRender.filter(transaction => {
                    const transactionDate = new Date(transaction.Date); // Assuming 'Date' column
                    const categoryMatch = selectedCategory === '' || transaction.Category === selectedCategory;
                    const dateMatch = (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
                    return categoryMatch && dateMatch;
                });
            } else if (month !== null) { // Apply month filter if no advanced filters are active
                dataToRender = allTransactionsData.filter(transaction => {
                    const transactionDate = new Date(transaction.Date); // Assuming 'Date' column
                    return transactionDate.getMonth() + 1 === month;
                });
            } else { // Default to current month if no filters applied and no specific month passed
                 const today = new Date();
                 const currentMonth = today.getMonth() + 1;
                 dataToRender = allTransactionsData.filter(transaction => {
                    const transactionDate = new Date(transaction.Date);
                    return transactionDate.getMonth() + 1 === currentMonth;
                });
            }

            filteredTransactions = dataToRender.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc

            const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
            const startIndex = (currentTransactionsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const transactionsOnPage = filteredTransactions.slice(startIndex, endIndex);

            transactionsList.innerHTML = '';
            if (transactionsOnPage.length === 0) {
                transactionsList.innerHTML = '<p style="text-align: center; color: var(--text-light);">No transactions found.</p>';
            } else {
                transactionsOnPage.forEach(transaction => {
                    const transactionItem = document.createElement('div');
                    transactionItem.classList.add('transaction-item');
                    transactionItem.innerHTML = `
                        <div class="transaction-details">
                            <div class="category-icon ${transaction.Category ? transaction.Category.toLowerCase() : 'misc'}">
                                ${transaction.Type === 'expense' ? 'E' : 'I'}
                            </div>
                            <div class="transaction-info">
                                <h3>${transaction.Description || 'N/A'}</h3>
                                <p>${transaction.Category || 'N/A'} - ${formatDate(transaction.Date)}</p>
                            </div>
                        </div>
                        <div class="transaction-amount ${transaction.Type === 'expense' ? 'expense' : 'income'}">
                            ${formatCurrency(transaction.Amount)}
                        </div>
                    `;
                    transactionsList.appendChild(transactionItem);
                });
            }
            updatePaginationControls(totalPages);
        }

        function updatePaginationControls(totalPages) {
            prevPageButton.disabled = currentTransactionsPage === 1;
            nextPageButton.disabled = currentTransactionsPage === totalPages;

            pageNumbersDiv.innerHTML = '';
            const maxPageButtons = 5; // Number of page buttons to display
            let startPage = Math.max(1, currentTransactionsPage - Math.floor(maxPageButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

            if (endPage - startPage + 1 < maxPageButtons) {
                startPage = Math.max(1, endPage - maxPageButtons + 1);
            }

            if (startPage > 1) {
                const firstPageBtn = document.createElement('button');
                firstPageBtn.textContent = '1';
                firstPageBtn.addEventListener('click', () => { currentTransactionsPage = 1; renderTransactions(); });
                pageNumbersDiv.appendChild(firstPageBtn);
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    pageNumbersDiv.appendChild(ellipsis);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                if (i === currentTransactionsPage) {
                    pageButton.classList.add('active');
                }
                pageButton.addEventListener('click', () => {
                    currentTransactionsPage = i;
                    renderTransactions();
                });
                pageNumbersDiv.appendChild(pageButton);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    pageNumbersDiv.appendChild(ellipsis);
                }
                const lastPageBtn = document.createElement('button');
                lastPageBtn.textContent = totalPages;
                lastPageBtn.addEventListener('click', () => { currentTransactionsPage = totalPages; renderTransactions(); });
                pageNumbersDiv.appendChild(lastPageBtn);
            }
        }

        prevPageButton.addEventListener('click', () => {
            if (currentTransactionsPage > 1) {
                currentTransactionsPage--;
                renderTransactions();
            }
        });

        nextPageButton.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
            if (currentTransactionsPage < totalPages) {
                currentTransactionsPage++;
                renderTransactions();
            }
        });

        function fetchAndProcessTransactions() {
            fetchCSVData().then(data => {
                allTransactionsData = data;
                // Set initial month filter to current month for transactions page
                const today = new Date();
                const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => {
                    if (parseInt(btn.dataset.month) === currentMonth) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                renderTransactions(currentMonth);
            });
        }

        if (transactionFilterButton) {
            transactionFilterButton.addEventListener('click', () => {
                if (filterOptionsContainer) {
                    filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
                }
            });
        }

        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page on filter apply
                // Deactivate month buttons
                monthButtons.forEach(btn => btn.classList.remove('active'));
                renderTransactions();
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';

                // Reactivate current month button
                const today = new Date();
                const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month=\"${currentMonth}\"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
                renderTransactions(currentMonth); // Render with current month
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        }

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                currentTransactionsPage = 1; // Reset page
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                // Clear other filters when a month is selected
                categoryFilterDropdown.value = '';
                startDateInput.value = '';
                endDateInput.value = '';
                renderTransactions(selectedMonth);
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        });

        fetchAndProcessTransactions(); // Initial fetch and render for transactions page

    } else if (document.getElementById('savings-page')) {
        const totalSavingsAmountElement = document.getElementById('totalSavingsAmount');
        const savingsTransactionsList = document.getElementById('savingsTransactionsList');
        const savingsPaginationControls = document.getElementById('savingsPaginationControls');
        const savingsPrevPageButton = document.getElementById('savingsPrevPage');
        const savingsNextPageButton = document.getElementById('savingsNextPage');
        const savingsPageNumbersDiv = document.getElementById('savingsPageNumbers');

        const savingsGoalInput = document.getElementById('savingsGoalInput');
        const setGoalButton = document.getElementById('setGoalButton');
        const clearGoalButton = document.getElementById('clearGoalButton');
        const currentGoalDisplay = document.getElementById('currentGoalDisplay');
        const goalAmountDisplay = document.getElementById('goalAmountDisplay');
        const goalNameDisplay = document.getElementById('goalNameDisplay');
        const goalProgressText = document.getElementById('goalProgressText');


        let currentSavingsGoal = JSON.parse(localStorage.getItem(SAVINGS_GOAL_KEY));
        let currentSavings = parseFloat(localStorage.getItem(SAVINGS_CURRENT_KEY)) || 0;

        function updateSavingsPage() {
            totalSavingsAmountElement.textContent = formatCurrency(currentSavings);
            updateGoalDisplay();
            renderSavingsTransactions();
        }

        function renderSavingsTransactions() {
            // Filter transactions that are 'income' and specifically for savings, or 'expense' that are withdrawals
            // For now, let's assume all income is 'savings' and all expenses are 'withdrawal' from savings for simplicity.
            // In a real app, you'd have a 'Savings' category for income/expense
            const savingsRelatedTransactions = allTransactionsData.filter(t =>
                t.Type === 'income' || (t.Type === 'expense' && t.Category === 'Savings Withdrawal') // Assuming 'Savings Withdrawal' category
            ).sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc


            allSavingsDataGlobal = savingsRelatedTransactions; // Update global savings data for pagination

            const totalPages = Math.ceil(allSavingsDataGlobal.length / ITEMS_PER_PAGE);
            const startIndex = (currentSavingsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const transactionsOnPage = allSavingsDataGlobal.slice(startIndex, endIndex);

            savingsTransactionsList.innerHTML = '';
            if (transactionsOnPage.length === 0) {
                savingsTransactionsList.innerHTML = '<p style="text-align: center; color: var(--text-light);">No savings transactions recorded.</p>';
            } else {
                transactionsOnPage.forEach(transaction => {
                    const item = document.createElement('div');
                    item.classList.add('transaction-item'); // Reuse transaction-item styling
                    item.innerHTML = `
                        <div class="transaction-details">
                            <div class="category-icon ${transaction.Type === 'income' ? 'income' : 'misc'}">
                                ${transaction.Type === 'income' ? '&#8369;' : '&#8369;'}
                            </div>
                            <div class="transaction-info">
                                <h3>${transaction.Description || 'Savings Transaction'}</h3>
                                <p>${transaction.Type === 'income' ? 'Deposit' : 'Withdrawal'} - ${formatDate(transaction.Date)}</p>
                            </div>
                        </div>
                        <div class="transaction-amount ${transaction.Type === 'income' ? 'income' : 'expense'}">
                            ${formatCurrency(transaction.Amount)}
                        </div>
                    `;
                    savingsTransactionsList.appendChild(item);
                });
            }
            updateSavingsPaginationControls(totalPages);
        }

        function updateSavingsPaginationControls(totalPages) {
            savingsPrevPageButton.disabled = currentSavingsPage === 1;
            savingsNextPageButton.disabled = currentSavingsPage === totalPages;

            savingsPageNumbersDiv.innerHTML = '';
            const maxPageButtons = 5;
            let startPage = Math.max(1, currentSavingsPage - Math.floor(maxPageButtons / 2));
            let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

            if (endPage - startPage + 1 < maxPageButtons) {
                startPage = Math.max(1, endPage - maxPageButtons + 1);
            }

            if (startPage > 1) {
                const firstPageBtn = document.createElement('button');
                firstPageBtn.textContent = '1';
                firstPageBtn.addEventListener('click', () => { currentSavingsPage = 1; renderSavingsTransactions(); });
                savingsPageNumbersDiv.appendChild(firstPageBtn);
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    savingsPageNumbersDiv.appendChild(ellipsis);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                if (i === currentSavingsPage) {
                    pageButton.classList.add('active');
                }
                pageButton.addEventListener('click', () => {
                    currentSavingsPage = i;
                    renderSavingsTransactions();
                });
                savingsPageNumbersDiv.appendChild(pageButton);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    savingsPageNumbersDiv.appendChild(ellipsis);
                }
                const lastPageBtn = document.createElement('button');
                lastPageBtn.textContent = totalPages;
                lastPageBtn.addEventListener('click', () => { currentSavingsPage = totalPages; renderSavingsTransactions(); });
                savingsPageNumbersDiv.appendChild(lastPageBtn);
            }
        }

        if (savingsPrevPageButton) {
            savingsPrevPageButton.addEventListener('click', () => {
                if (currentSavingsPage > 1) {
                    currentSavingsPage--;
                    renderSavingsTransactions();
                }
            });
        }

        if (savingsNextPageButton) {
            savingsNextPageButton.addEventListener('click', () => {
                const totalPages = Math.ceil(allSavingsDataGlobal.length / ITEMS_PER_PAGE);
                if (currentSavingsPage < totalPages) {
                    currentSavingsPage++;
                    renderSavingsTransactions();
                }
            });
        }

        function updateGoalDisplay() {
            if (currentSavingsGoal) {
                goalNameDisplay.textContent = currentSavingsGoal.name;
                goalAmountDisplay.textContent = formatCurrency(currentSavingsGoal.amount);

                const progress = (currentSavings / currentSavingsGoal.amount) * 100;
                if (progress >= 100) {
                    goalProgressText.textContent = `Goal Achieved! You saved ${formatCurrency(currentSavings)}!`;
                    goalProgressText.style.color = 'var(--accent-green)';
                } else {
                    goalProgressText.textContent = `${progress.toFixed(1)}% towards your goal.`;
                    goalProgressText.style.color = 'var(--accent-orange)';
                }
                currentGoalDisplay.style.display = 'block';
            } else {
                currentGoalDisplay.style.display = 'none';
            }
        }

        if (setGoalButton) {
            setGoalButton.addEventListener('click', () => {
                const goalAmount = parseFloat(savingsGoalInput.value);
                const goalName = document.getElementById('savingsGoalNameInput').value;

                if (isNaN(goalAmount) || goalAmount <= 0) {
                    alert('Please enter a valid positive amount for your savings goal.');
                    return;
                }
                if (!goalName.trim()) {
                    alert('Please enter a name for your savings goal.');
                    return;
                }

                currentSavingsGoal = { amount: goalAmount, name: goalName };
                localStorage.setItem(SAVINGS_GOAL_KEY, JSON.stringify(currentSavingsGoal));
                updateGoalDisplay();
                savingsGoalInput.value = ''; // Clear input
                document.getElementById('savingsGoalNameInput').value = '';
            });
        }

        if (clearGoalButton) {
            clearGoalButton.addEventListener('click', () => {
                localStorage.removeItem(SAVINGS_GOAL_KEY);
                currentSavingsGoal = null;
                updateGoalDisplay();
            });
        }

        // Initial fetch and render for savings page
        fetchCSVData().then(data => {
            allTransactionsData = data; // Load all transactions to calculate total savings
            // Calculate total savings from income transactions
            currentSavings = allTransactionsData
                .filter(t => t.Type === 'income') // Assuming all income contributes to savings or a general fund
                .reduce((sum, t) => sum + parseFloat(t.Amount), 0);
            localStorage.setItem(SAVINGS_CURRENT_KEY, currentSavings.toFixed(2)); // Store current savings

            updateSavingsPage();
        });
    }

    // --- Add Transaction FAB (global) ---
    const addTransactionFab = document.getElementById('addTransactionFab');
    if (addTransactionFab) {
        addTransactionFab.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

});
