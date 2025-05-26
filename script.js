document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';
    const SAVINGS_GOAL_KEY = 'savingsGoal'; // Key for localStorage

    function parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(value => value.trim());
            if (values.length !== headers.length) {
                console.warn('CSV Parse Warning: Skipping malformed row (column mismatch):', lines[i]);
                continue;
            }
            const entry = {};
            headers.forEach((header, index) => {
                entry[header] = values[index];
            });
            data.push(entry);
        }
        return data;
    }

    function formatCurrency(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            return '₱ 0.00';
        }
        return `₱ ${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function mapCategoryAndIcon(type, whatKind) {
        let category = 'Misc';
        let icon = '✨';

        const lowerCaseWhatKind = whatKind ? whatKind.toLowerCase() : '';
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                case 'savings contribution': icon = '💰'; break; // Specific icon for savings contributions
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                case 'allowance': category = 'Misc'; icon = '🚶'; break;
                default: category = 'Misc'; icon = '✨'; break;
            }
        }
        return { category, icon };
    }

    // --- Dark Mode Toggle ---
    const nightModeToggle = document.getElementById('nightModeToggle');
    const body = document.body;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    } else {
        // Default to light mode if no preference saved
        body.classList.add('light-mode');
    }

    if (nightModeToggle) {
        nightModeToggle.addEventListener('click', () => {
            if (body.classList.contains('light-mode')) {
                body.classList.remove('light-mode');
                body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark-mode');
            } else {
                body.classList.remove('dark-mode');
                body.classList.add('light-mode');
                localStorage.setItem('theme', 'light-mode');
            }
        });
    }

    // --- Hamburger Menu Logic ---
    const mainMenuButton = document.getElementById('mainMenuButton');
    const mainMenuSidebar = document.getElementById('mainMenuSidebar');
    const closeSidebarButton = document.getElementById('closeSidebarButton');

    if (mainMenuButton && mainMenuSidebar && closeSidebarButton) {
        mainMenuButton.addEventListener('click', () => {
            mainMenuSidebar.classList.add('open');
        });

        closeSidebarButton.addEventListener('click', () => {
            mainMenuSidebar.classList.remove('open');
        });

        // Close sidebar if clicked outside of it
        document.addEventListener('click', (event) => {
            if (mainMenuSidebar.classList.contains('open') &&
                !mainMenuSidebar.contains(event.target) &&
                !mainMenuButton.contains(event.target)) {
                mainMenuSidebar.classList.remove('open');
            }
        });
    }


    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard() {
        if (!document.getElementById('dashboard-page')) return;

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;
            let totalSavingsAmount = 0; // New variable for savings

            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType || !entryWhatKind) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') {
                        expenseCategoriesForChart.Food += amount;
                    } else if (entryWhatKind === 'medicines') {
                        expenseCategoriesForChart.Medicines += amount;
                    } else if (entryWhatKind === 'online shopping') {
                        expenseCategoriesForChart.Shopping += amount;
                    } else {
                        expenseCategoriesForChart.Misc += amount;
                    }
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                    if (entryWhatKind === 'savings contribution') {
                        totalSavingsAmount += amount;
                    }
                }
            });

            const netExpenseForDisplay = totalExpensesAmount;
            document.getElementById('netExpenseValue').textContent = formatCurrency(netExpenseForDisplay);

            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount; // Assuming totalGainsAmount acts as budget for now

            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;

            let remainingBalancePercentage = 0;
            if (totalIncomeOrBudget > 0) {
                remainingBalancePercentage = (remainingBalance / totalIncomeOrBudget) * 100;
            }
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            document.getElementById('remainingBalancePct').textContent = `${displayPercentage}%`;

            let progressOffset = 0;
            let progressColor = 'var(--accent-green)';
            const radius = 34;
            const circumference = 2 * Math.PI * radius;

            if (displayPercentage >= 100) {
                progressOffset = 0;
            } else if (displayPercentage > 0) {
                progressOffset = circumference - (displayPercentage / 100) * circumference;
                if (displayPercentage < 25) {
                    progressColor = 'var(--accent-red)'; // Change to red if remaining is low
                } else if (displayPercentage < 50) {
                    progressColor = 'var(--accent-orange)'; // Orange for mid-range
                }
            } else { // remainingBalance <= 0
                progressOffset = circumference; // Circle fully red/empty visually
                progressColor = 'var(--accent-red)';
            }

            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor;
            }

            const categoryNames = ['Food', 'Medicines', 'Shopping', 'Misc'];
            const categoryAmounts = [
                expenseCategoriesForChart.Food,
                expenseCategoriesForChart.Medicines,
                expenseCategoriesForChart.Shopping,
                expenseCategoriesForChart.Misc,
            ];
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;


            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) {
                    window.expenseChartInstance.destroy();
                }
                const chartColors = [
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim()
                ];
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartColors,
                            borderColor: 'var(--card-bg)',
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '80%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.label || '';
                                        if (label) { label += ': '; }
                                        if (context.parsed !== null) { label += formatCurrency(context.parsed); }
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Update Savings Card
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                savingsAmountSpan.dataset.actualAmount = totalSavingsAmount; // Store actual for masking
                savingsAmountSpan.textContent = formatCurrency(totalSavingsAmount);
            }

        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
        }
    }

    // Mask Savings Button
    const maskSavingsButton = document.getElementById('maskSavingsButton');
    if (maskSavingsButton) {
        maskSavingsButton.addEventListener('click', () => {
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                if (savingsAmountSpan.textContent.includes('●')) {
                    savingsAmountSpan.textContent = formatCurrency(savingsAmountSpan.dataset.actualAmount || 0);
                    maskSavingsButton.textContent = 'Mask';
                } else {
                    savingsAmountSpan.textContent = '₱ ●●.●●●.●●';
                    maskSavingsButton.textContent = 'Show';
                }
            }
        });
    }

    // --- Transactions Page Specific Logic (transactions.html) ---
    let allTransactionsData = []; // Store all fetched data for consistent filtering

    async function fetchAndProcessTransactions() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store raw data

            // Populate category filter dropdown
            populateCategoryFilter();
            // Initial render with current month
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            renderTransactions(currentMonth); // Initial render with current month
        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions. Please check the data source.</p>';
            }
        }
    }

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        // Clear existing options except "All Categories"
        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allTransactionsData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                uniqueCategories.add('Gains');
            }
            if (entry.Type && entry.Type.toLowerCase() === 'expenses') {
                uniqueCategories.add('Expenses');
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort();
        // Add 'Gains' and 'Expenses' specifically at the top if they exist
        const prioritizedCategories = [];
        if (sortedCategories.includes('Gains')) {
            prioritizedCategories.push('Gains');
            sortedCategories.splice(sortedCategories.indexOf('Gains'), 1);
        }
        if (sortedCategories.includes('Expenses')) {
            prioritizedCategories.push('Expenses');
            sortedCategories.splice(sortedCategories.indexOf('Expenses'), 1);
        }

        // Add the rest, filtering out "Salary", "Allowance", "Savings Contribution" if they are sub-categories of "Gains"
        sortedCategories.forEach(cat => {
            const lowerCaseCat = cat.toLowerCase();
            if (!['salary', 'allowance', 'savings contribution'].includes(lowerCaseCat)) {
                prioritizedCategories.push(cat);
            }
        });

        prioritizedCategories.forEach(category => {
            if (category) {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilterDropdown.appendChild(option);
            }
        });
    }

    function renderTransactions(selectedMonth, selectedCategory = '', startDate = null, endDate = null) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        let filteredData = allTransactionsData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Use 'What kind?' from CSV headers

            if (isNaN(amount) || isNaN(date) || !entryType) {
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            // Month filtering (always apply if a month button is active)
            if (selectedMonth && entryDate.getMonth() + 1 !== selectedMonth) {
                return false;
            }

            // Category filtering
            if (selectedCategory) {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategoryInEntry = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Use 'What kind?'
                const entryCategoryType = entry.Type ? entry.Type.toLowerCase() : ''; // 'gains' or 'expenses'

                if (lowerCaseSelectedCategory === 'gains') {
                    if (entryCategoryType !== 'gains') return false;
                } else if (lowerCaseSelectedCategory === 'expenses') {
                    if (entryCategoryType !== 'expenses') return false;
                } else if (actualCategoryInEntry !== lowerCaseSelectedCategory) {
                    return false;
                }
            }

            // Date range filtering
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of the day

                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }

            return true;
        });

        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        transactionsListDiv.innerHTML = '';

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        filteredData.forEach(entry => {
            const entryDate = new Date(entry.Date);
            entryDate.setHours(0, 0, 0, 0);

            let dateHeader;
            if (entryDate.getTime() === today.getTime()) {
                dateHeader = 'Today';
            } else if (entryDate.getTime() === yesterday.getTime()) {
                dateHeader = 'Yesterday';
            } else {
                dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }

            if (!groupedTransactions[dateHeader]) {
                groupedTransactions[dateHeader] = [];
            }
            groupedTransactions[dateHeader].push(entry);
        });

        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1;
            if (b === 'Yesterday') return 1;
            const dateA = new Date(a);
            const dateB = new Date(b);
            if (!isNaN(dateA) && !isNaN(dateB)) {
                return dateB - dateA;
            }
            return 0;
        });

        sortedDates.forEach(dateHeader => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const headerDiv = document.createElement('div');
            headerDiv.classList.add('transaction-date-header');
            headerDiv.textContent = dateHeader;
            groupDiv.appendChild(headerDiv);

            groupedTransactions[dateHeader].sort((a, b) => {
                const timeA = a.Time ? a.Time.split(':').map(Number) : [0, 0, 0];
                const timeB = b.Time ? b.Time.split(':').map(Number) : [0, 0, 0];
                if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
                if (timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
                return timeA[2] - timeB[2];
            });

            groupedTransactions[dateHeader].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const categoryIconDiv = document.createElement('div');
                categoryIconDiv.classList.add('transaction-category-icon');

                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                     categoryIconDiv.classList.add('category-gain');
                } else {
                    switch (mappedCategory.toLowerCase()) {
                        case 'food': categoryIconDiv.classList.add('category-food'); break;
                        case 'medicines': categoryIconDiv.classList.add('category-medicines'); break;
                        case 'shopping': categoryIconDiv.classList.add('category-shopping'); break;
                        default: categoryIconDiv.classList.add('category-misc'); break;
                    }
                }

                categoryIconDiv.textContent = categoryIcon;
                itemDiv.appendChild(categoryIconDiv);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description && entry.Description.trim() !== '' ? entry.Description : (entry['What kind?'] && entry['What kind?'].trim() !== '' ? entry['What kind?'] : 'N/A');
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || '';
                detailsDiv.appendChild(timeSpan);

                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type && entry.Type.toLowerCase() === 'expenses') {
                    amountSpan.classList.add('expense');
                } else if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                    amountSpan.classList.add('gain');
                }
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            transactionsListDiv.appendChild(groupDiv);
        });

        if (filteredData.length === 0) {
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for the selected filters.</p>';
        }
    }

    // --- Savings Page Logic (savings.html) ---
    async function updateSavingsPage() {
        if (!document.getElementById('savings-page')) return;

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalSavings = 0;
            const recentContributions = [];

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'] && entry['What kind?'].toLowerCase() === 'savings contribution' && !isNaN(amount)) {
                    totalSavings += amount;
                    recentContributions.push({
                        date: entry.Date,
                        description: entry.Description || 'Savings Contribution',
                        amount: amount
                    });
                }
            });

            // Sort recent contributions by date, newest first
            recentContributions.sort((a, b) => new Date(b.date) - new Date(a.date));

            const savingsGoal = parseFloat(localStorage.getItem(SAVINGS_GOAL_KEY)) || 0;

            document.getElementById('totalSavingsAmount').textContent = formatCurrency(totalSavings);
            document.getElementById('savingsGoal').textContent = formatCurrency(savingsGoal);

            const savingsProgressBar = document.getElementById('savingsProgressBar');
            const savingsProgressPct = document.getElementById('savingsProgressPct');

            let percentage = 0;
            if (savingsGoal > 0) {
                percentage = (totalSavings / savingsGoal) * 100;
            }
            percentage = Math.min(100, Math.max(0, percentage)); // Cap between 0 and 100

            if (savingsProgressBar) {
                savingsProgressBar.style.width = `${percentage}%`;
            }
            if (savingsProgressPct) {
                savingsProgressPct.textContent = `${Math.round(percentage)}%`;
            }

            const recentContributionsList = document.getElementById('recentContributionsList');
            if (recentContributionsList) {
                recentContributionsList.innerHTML = ''; // Clear previous entries
                if (recentContributions.length > 0) {
                    recentContributions.slice(0, 5).forEach(contribution => { // Show top 5 recent
                        const itemDiv = document.createElement('div');
                        itemDiv.classList.add('contribution-item');
                        itemDiv.innerHTML = `
                            <div class="contribution-details">
                                <span class="date">${new Date(contribution.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <span class="description">${contribution.description}</span>
                            </div>
                            <span class="contribution-amount">${formatCurrency(contribution.amount)}</span>
                        `;
                        recentContributionsList.appendChild(itemDiv);
                    });
                } else {
                    recentContributionsList.innerHTML = '<p style="text-align: center; color: var(--text-light);">No recent contributions.</p>';
                }
            }

            // Edit Goal button functionality
            const editSavingsGoalButton = document.getElementById('editSavingsGoal');
            if (editSavingsGoalButton) {
                editSavingsGoalButton.addEventListener('click', () => {
                    let newGoal = prompt('Enter your new savings goal (e.g., 50000):', savingsGoal);
                    if (newGoal !== null) {
                        newGoal = parseFloat(newGoal);
                        if (!isNaN(newGoal) && newGoal >= 0) {
                            localStorage.setItem(SAVINGS_GOAL_KEY, newGoal);
                            updateSavingsPage(); // Re-render page with new goal
                        } else {
                            alert('Please enter a valid positive number for your savings goal.');
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error fetching or processing CSV for savings page:', error);
            if (document.getElementById('totalSavingsAmount')) document.getElementById('totalSavingsAmount').textContent = '₱ Error';
            if (document.getElementById('savingsGoal')) document.getElementById('savingsGoal').textContent = '₱ Error';
            if (document.getElementById('recentContributionsList')) document.getElementById('recentContributionsList').innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading savings data.</p>';
        }
    }


    // --- Calculator Logic ---
    const calculatorOverlay = document.getElementById('calculatorOverlay');
    const calculatorDisplay = document.getElementById('calculatorDisplay');
    const calculatorButtons = document.querySelector('.calculator-buttons');
    const closeCalculatorButton = document.getElementById('closeCalculatorButton');
    const openCalculatorFab = document.getElementById('openCalculatorFab');

    let currentInput = '0';
    let firstOperand = null;
    let operator = null;
    let waitingForSecondOperand = false;

    function updateDisplay() {
        calculatorDisplay.value = currentInput;
    }

    function resetCalculator() {
        currentInput = '0';
        firstOperand = null;
        operator = null;
        waitingForSecondOperand = false;
    }

    function inputDigit(digit) {
        if (waitingForSecondOperand === true) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateDisplay();
    }

    function inputDecimal(dot) {
        if (waitingForSecondOperand === true) {
            currentInput = '0.';
            waitingForSecondOperand = false;
            updateDisplay();
            return;
        }
        if (!currentInput.includes(dot)) {
            currentInput += dot;
        }
        updateDisplay();
    }

    function handleOperator(nextOperator) {
        const inputValue = parseFloat(currentInput);

        if (operator && waitingForSecondOperand) {
            operator = nextOperator; // Allow changing operator before second operand is entered
            return;
        }

        if (firstOperand === null) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            currentInput = String(parseFloat(result.toFixed(8))); // Limit decimals for display
            firstOperand = result;
        }

        waitingForSecondOperand = true;
        operator = nextOperator;
        updateDisplay();
    }

    const performCalculation = {
        '/': (firstOperand, secondOperand) => secondOperand === 0 ? 'Error' : firstOperand / secondOperand,
        '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
        '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
        '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
    };

    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) {
                return;
            }

            if (target.classList.contains('operator')) {
                handleOperator(target.dataset.action);
                return;
            }

            if (target.classList.contains('decimal')) {
                inputDecimal(target.textContent);
                return;
            }

            if (target.classList.contains('clear')) {
                resetCalculator();
                updateDisplay();
                return;
            }

            if (target.classList.contains('backspace')) {
                currentInput = currentInput.slice(0, -1);
                if (currentInput === '') { // If nothing left, set to '0'
                    currentInput = '0';
                }
                updateDisplay();
                return;
            }

            if (target.classList.contains('equals')) {
                if (firstOperand === null || operator === null || waitingForSecondOperand) {
                    return; // Do nothing if nothing to compute
                }
                const inputValue = parseFloat(currentInput);
                let result = performCalculation[operator](firstOperand, inputValue);

                if (result === 'Error') {
                    currentInput = 'Error';
                } else {
                    currentInput = String(parseFloat(result.toFixed(8))); // Limit decimals for display
                }

                firstOperand = null; // Clear for next calculation
                operator = null; // Clear operator
                waitingForSecondOperand = true; // Ready for new input or chain operation
                updateDisplay();
                return;
            }

            inputDigit(target.textContent);
        });
    }

    if (openCalculatorFab) {
        openCalculatorFab.addEventListener('click', () => {
            calculatorOverlay.classList.add('active');
            resetCalculator(); // Reset calculator state when opening
            updateDisplay();
        });
    }

    if (closeCalculatorButton) {
        closeCalculatorButton.addEventListener('click', () => {
            calculatorOverlay.classList.remove('active');
        });
    }

    // Close calculator if clicked outside (on overlay)
    if (calculatorOverlay) {
        calculatorOverlay.addEventListener('click', (event) => {
            if (event.target === calculatorOverlay) {
                calculatorOverlay.classList.remove('active');
            }
        });
    }


    // --- Common Logic & Event Listeners ---

    const addTransactionFab = document.getElementById('addTransactionFab');
    if (addTransactionFab) {
        addTransactionFab.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    // Initialize page-specific functions
    if (document.getElementById('dashboard-page')) {
        updateDashboard();
    } else if (document.getElementById('transactions-page')) {
        const today = new Date();
        let currentMonth = today.getMonth() + 1; // Default to current month

        // Get filter elements
        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');

        // Event listener for main Filter button (toggle visibility)
        if (filterButton) {
            filterButton.addEventListener('click', () => {
                filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
            });
        }

        // Apply Filters button click
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value; // Will be empty string if not set
                const endDate = endDateInput.value; // Will be empty string if not set

                const activeMonthButton = document.querySelector('.month-button.active');
                currentMonth = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;

                const finalMonth = (startDate || endDate) ? null : currentMonth;

                renderTransactions(finalMonth, selectedCategory, startDate, endDate);
                filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            });
        }

        // Clear Filters button click
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                categoryFilterDropdown.value = ''; // Reset dropdown
                startDateInput.value = ''; // Clear date inputs
                endDateInput.value = ''; // Clear date inputs

                const today = new Date();
                currentMonth = today.getMonth() + 1;
                const monthButtons = document.querySelectorAll('.month-button');
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) {
                    currentMonthBtn.classList.add('active');
                }
                renderTransactions(currentMonth); // Render with only current month filter
                filterOptionsContainer.style.display = 'none'; // Hide filters
            });
        }


        // Set initial active month button
        const monthButtons = document.querySelectorAll('.month-button');
        monthButtons.forEach(button => {
            if (parseInt(button.dataset.month) === currentMonth) {
                button.classList.add('active');
            }
        });

        // Add event listeners for month buttons
        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month); // Update currentMonth
                // Clear custom date filters when a month is selected
                startDateInput.value = '';
                endDateInput.value = '';
                categoryFilterDropdown.value = ''; // Clear category filter too
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none'; // Hide filters after month selection
            });
        });

        // Initial data fetch and render for transactions page
        fetchAndProcessTransactions();
    } else if (document.getElementById('savings-page')) {
        updateSavingsPage();
    }
});
