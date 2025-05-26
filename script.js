document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';
    const SAVINGS_GOAL_KEY = 'savingsGoal'; // Key for localStorage

    let allTransactionsData = [];
    let filteredTransactions = []; // Used for transactions page filtering
    let transactionsCurrentPage = 1;
    const transactionsPerPage = 20;

    let savingsGainsData = []; // To store only 'gains' for the savings entries
    let savingsCurrentPage = 1;
    const savingsPerPage = 10;

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

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    } else {
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
            let totalSavingsAmount = 0;

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

            // Update summary cards
            document.getElementById('totalExpensesAmount').textContent = formatCurrency(totalExpensesAmount);
            document.getElementById('totalGainsAmount').textContent = formatCurrency(totalGainsAmount);

            // Update net expense (Gains - Expenses)
            const netExpense = totalGainsAmount - totalExpensesAmount;
            const netExpenseValueElement = document.getElementById('netExpenseValue');
            if (netExpenseValueElement) {
                netExpenseValueElement.textContent = formatCurrency(netExpense);
                netExpenseValueElement.classList.toggle('expense', netExpense < 0);
                netExpenseValueElement.classList.toggle('gain', netExpense >= 0);
            }

            // Update Remaining Balance Card (Example: assuming a fixed limit of ₱10000 for demonstration)
            const overallLimit = 10000; // This can be made dynamic if needed
            const remainingBalance = overallLimit - totalExpensesAmount;
            const remainingBalanceAmountElement = document.getElementById('remainingBalanceAmount');
            if (remainingBalanceAmountElement) {
                remainingBalanceAmountElement.textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(overallLimit)}`;
            }

            const remainingBalancePctElement = document.getElementById('remainingBalancePct');
            if (remainingBalancePctElement) {
                const percentage = overallLimit > 0 ? Math.round((remainingBalance / overallLimit) * 100) : 0;
                remainingBalancePctElement.textContent = `${Math.max(0, percentage)}%`; // Ensure not negative
                // Update progress circle
                const circumference = 2 * Math.PI * 34; // r=34 from style.css
                const progressOffset = circumference - (Math.max(0, percentage) / 100) * circumference;
                const progressColor = percentage >= 50 ? 'var(--accent-green)' :
                                      percentage >= 20 ? 'var(--accent-orange)' : 'var(--accent-red)';
                const progressCircle = document.querySelector('.progress-ring-progress');
                if (progressCircle) {
                    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                    progressCircle.style.strokeDashoffset = progressOffset;
                    progressCircle.style.stroke = progressColor;
                }
            }


            // Update Expense Chart (Donut Chart)
            const expenseChartCtx = document.getElementById('expenseChart').getContext('2d');
            if (window.expenseChart instanceof Chart) {
                window.expenseChart.destroy();
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


            window.expenseChart = new Chart(expenseChartCtx, {
                type: 'doughnut',
                data: {
                    labels: categoryNames,
                    datasets: [{
                        data: categoryAmounts,
                        backgroundColor: [
                            'var(--accent-green)', // Food
                            'var(--accent-red)',    // Medicines
                            'var(--accent-orange)', // Shopping
                            'var(--accent-blue)'    // Misc
                        ],
                        borderColor: [
                            'var(--card-bg)',
                            'var(--card-bg)',
                            'var(--card-bg)',
                            'var(--card-bg)'
                        ],
                        borderWidth: 2,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '80%',
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed !== null) {
                                        label += formatCurrency(context.parsed);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            // Display error messages on dashboard elements
            document.getElementById('totalExpensesAmount').textContent = '₱ Error';
            document.getElementById('totalGainsAmount').textContent = '₱ Error';
            document.getElementById('netExpenseValue').textContent = '₱ Error';
            document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
            if (window.expenseChart instanceof Chart) {
                window.expenseChart.destroy();
            }
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading chart data.</p>';
            }
        }
    }

    // --- Transactions Page Logic (transactions.html) ---
    const filterButton = document.getElementById('filterButton');
    const filterOptionsContainer = document.getElementById('filterOptionsContainer');
    const applyFiltersButton = document.getElementById('applyFiltersButton');
    const clearFiltersButton = document.getElementById('clearFiltersButton');
    const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');
    const transactionsListDiv = document.getElementById('transactionsList');

    let currentMonth = new Date().getMonth() + 1; // 1-indexed (Jan=1, Dec=12)

    if (filterButton && filterOptionsContainer) {
        filterButton.addEventListener('click', () => {
            filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex';
        });
    }

    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', () => {
            currentMonth = null; // Clear month filter when custom filters are applied
            renderTransactions();
            filterOptionsContainer.style.display = 'none'; // Hide filters after applying
            // Deactivate all month buttons
            document.querySelectorAll('.month-button').forEach(btn => btn.classList.remove('active'));
        });
    }

    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', () => {
            categoryFilterDropdown.value = '';
            startDateInput.value = '';
            endDateInput.value = '';
            currentMonth = new Date().getMonth() + 1; // Reset to current month
            renderTransactions();
            // Activate current month button
            document.querySelectorAll('.month-button').forEach(btn => {
                if (parseInt(btn.dataset.month) === currentMonth) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            filterOptionsContainer.style.display = 'none'; // Hide filters after clearing
        });
    }

    function populateCategoryFilter() {
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';
        const uniqueCategories = new Set();
        allTransactionsData.forEach(entry => {
            if (entry['What kind?']) {
                uniqueCategories.add(entry['What kind?'].trim());
            }
            // Add custom categories derived from mapping if they are not directly in 'What kind?'
            const { category } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
            if (category !== 'Misc' && category !== 'Gain') { // 'Misc' and 'Gain' are generic, might not need as filter options
                uniqueCategories.add(category);
            }
        });

        Array.from(uniqueCategories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilterDropdown.appendChild(option);
        });
    }

    function renderTransactions() {
        if (!transactionsListDiv) return;

        const selectedCategory = categoryFilterDropdown ? categoryFilterDropdown.value : '';
        const startDate = startDateInput ? startDateInput.value : '';
        const endDate = endDateInput ? endDateInput.value : '';

        filteredTransactions = allTransactionsData.filter(entry => {
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
            const entryAmount = parseFloat(entry.Amount);
            const entryDate = new Date(entry.Date);

            if (isNaN(entryAmount) || !entryType || !entry['What kind?'] || isNaN(entryDate)) {
                return false; // Skip malformed entries
            }

            // Month filtering
            if (currentMonth !== null && entryDate.getMonth() + 1 !== currentMonth) {
                return false;
            }

            // Category filtering
            if (selectedCategory) {
                const { category: mappedCategory } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
                if (selectedCategory === 'Gain' && entryType !== 'gains') return false;
                if (selectedCategory !== 'Gain' && mappedCategory !== selectedCategory && entry['What kind?'].toLowerCase() !== selectedCategory.toLowerCase()) {
                    return false;
                }
            }

            // Date range filtering
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (entryDate < start || entryDate > end) {
                    return false;
                }
            }
            return true;
        });

        filteredTransactions.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date descending

        const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
        transactionsCurrentPage = Math.min(transactionsCurrentPage, totalPages || 1); // Adjust current page if it exceeds new total pages
        transactionsCurrentPage = Math.max(1, transactionsCurrentPage); // Ensure current page is at least 1

        const startIndex = (transactionsCurrentPage - 1) * transactionsPerPage;
        const endIndex = startIndex + transactionsPerPage;
        const transactionsToDisplay = filteredTransactions.slice(startIndex, endIndex);

        transactionsListDiv.innerHTML = '';
        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        transactionsToDisplay.forEach(entry => {
            const entryDate = new Date(entry.Date);
            let dateKey;
            if (entryDate.toDateString() === today.toDateString()) {
                dateKey = 'Today';
            } else if (entryDate.toDateString() === yesterday.toDateString()) {
                dateKey = 'Yesterday';
            } else {
                dateKey = entryDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }

            if (!groupedTransactions[dateKey]) {
                groupedTransactions[dateKey] = [];
            }
            groupedTransactions[dateKey].push(entry);
        });

        for (const dateKey in groupedTransactions) {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeader = document.createElement('div');
            dateHeader.classList.add('transaction-date-header');
            dateHeader.textContent = dateKey;
            groupDiv.appendChild(dateHeader);

            groupedTransactions[dateKey].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('transaction-category-icon', `category-${category.toLowerCase().replace(/\s/g, '-')}`);
                iconSpan.textContent = icon;
                itemDiv.appendChild(iconSpan);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Name;
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                const entryDateTime = new Date(`${entry.Date} ${entry.Time}`);
                timeSpan.textContent = entryDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
        }

        if (transactionsToDisplay.length === 0) {
            transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for the selected filters.</p>';
        }

        setupTransactionPagination(totalPages);
    }

    function setupTransactionPagination(totalPages) {
        const paginationControls = document.getElementById('transactionPagination');
        if (!paginationControls) return;

        paginationControls.innerHTML = ''; // Clear previous pagination

        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }
        paginationControls.style.display = 'flex';

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = transactionsCurrentPage === 1;
        prevButton.addEventListener('click', () => {
            transactionsCurrentPage--;
            renderTransactions();
        });
        paginationControls.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${transactionsCurrentPage} of ${totalPages}`;
        pageInfo.classList.add('pagination-info');
        paginationControls.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = transactionsCurrentPage === totalPages;
        nextButton.addEventListener('click', () => {
            transactionsCurrentPage++;
            renderTransactions();
        });
        paginationControls.appendChild(nextButton);
    }


    async function fetchAndProcessTransactions() {
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv);

            if (document.getElementById('transactions-page')) {
                populateCategoryFilter();
                renderTransactions();
            }
        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            if (transactionsListDiv) {
                transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions. Please check the data source.</p>';
            }
        }
    }


    // --- Savings Page Logic (savings.html) ---
    async function updateSavingsPage() {
        if (!document.getElementById('savings-page')) return;

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalSavingsAmount = 0;
            savingsGainsData = [];

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType || !entryWhatKind) {
                    console.warn('Savings - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'gains') {
                    totalSavingsAmount += amount;
                    savingsGainsData.push(entry);
                }
            });

            // Update total savings amount
            const totalSavingsAmountElement = document.getElementById('totalSavingsAmount');
            if (totalSavingsAmountElement) {
                totalSavingsAmountElement.textContent = formatCurrency(totalSavingsAmount);
            }

            // Sort savings gains by date descending
            savingsGainsData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

            renderSavingsEntries(); // Initial render of savings entries

        } catch (error) {
            console.error('Error fetching or processing CSV for savings:', error);
            if (document.getElementById('totalSavingsAmount')) document.getElementById('totalSavingsAmount').textContent = '₱ Error';
            const savingsEntriesList = document.getElementById('savingsEntriesList');
            if (savingsEntriesList) {
                savingsEntriesList.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading savings data.</p>';
            }
        }
    }

    function renderSavingsEntries() {
        const savingsEntriesList = document.getElementById('savingsEntriesList');
        if (!savingsEntriesList) return;

        const totalPages = Math.ceil(savingsGainsData.length / savingsPerPage);
        savingsCurrentPage = Math.min(savingsCurrentPage, totalPages || 1); // Adjust current page if it exceeds new total pages
        savingsCurrentPage = Math.max(1, savingsCurrentPage); // Ensure current page is at least 1

        const startIndex = (savingsCurrentPage - 1) * savingsPerPage;
        const endIndex = startIndex + savingsPerPage;
        const entriesToDisplay = savingsGainsData.slice(startIndex, endIndex);

        savingsEntriesList.innerHTML = '';
        if (entriesToDisplay.length === 0) {
            savingsEntriesList.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">No savings gains entries found.</p>';
        }

        const groupedSavings = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        entriesToDisplay.forEach(entry => {
            const entryDate = new Date(entry.Date);
            let dateKey;
            if (entryDate.toDateString() === today.toDateString()) {
                dateKey = 'Today';
            } else if (entryDate.toDateString() === yesterday.toDateString()) {
                dateKey = 'Yesterday';
            } else {
                dateKey = entryDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }

            if (!groupedSavings[dateKey]) {
                groupedSavings[dateKey] = [];
            }
            groupedSavings[dateKey].push(entry);
        });

        for (const dateKey in groupedSavings) {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group'); // Reusing transaction-group styling

            const dateHeader = document.createElement('div');
            dateHeader.classList.add('transaction-date-header'); // Reusing styling
            dateHeader.textContent = dateKey;
            groupDiv.appendChild(dateHeader);

            groupedSavings[dateKey].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item'); // Reusing styling

                const { category, icon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('transaction-category-icon', `category-${category.toLowerCase().replace(/\s/g, '-')}`);
                iconSpan.textContent = icon;
                itemDiv.appendChild(iconSpan);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Name;
                detailsDiv.appendChild(nameSpan);

                const timeSpan = document.createElement('span');
                timeSpan.classList.add('transaction-time');
                const entryDateTime = new Date(`${entry.Date} ${entry.Time}`);
                timeSpan.textContent = entryDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                detailsDiv.appendChild(timeSpan);

                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount', 'gain'); // Always gain for savings entries
                amountSpan.textContent = formatCurrency(entry.Amount);
                itemDiv.appendChild(amountSpan);
                groupDiv.appendChild(itemDiv);
            });
            savingsEntriesList.appendChild(groupDiv);
        }

        setupSavingsPagination(totalPages);
    }

    function setupSavingsPagination(totalPages) {
        const paginationControls = document.getElementById('savingsPagination');
        if (!paginationControls) return;

        paginationControls.innerHTML = ''; // Clear previous pagination

        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }
        paginationControls.style.display = 'flex';

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = savingsCurrentPage === 1;
        prevButton.addEventListener('click', () => {
            savingsCurrentPage--;
            renderSavingsEntries();
        });
        paginationControls.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${savingsCurrentPage} of ${totalPages}`;
        pageInfo.classList.add('pagination-info');
        paginationControls.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = savingsCurrentPage === totalPages;
        nextButton.addEventListener('click', () => {
            savingsCurrentPage++;
            renderSavingsEntries();
        });
        paginationControls.appendChild(nextButton);
    }


    // --- Calculator Logic ---
    const calculatorOverlay = document.getElementById('calculatorOverlay');
    const calculatorDisplay = document.getElementById('calculatorDisplay');
    const calculatorButtons = document.querySelector('.calculator-buttons');
    const closeCalculatorButton = document.getElementById('closeCalculatorButton');
    const openCalculatorFab = document.getElementById('openCalculatorFab'); // FAB for opening calculator

    let currentInput = '0';
    let firstOperand = null;
    let operator = null;
    let waitingForSecondOperand = false;

    function updateDisplay() {
        if (calculatorDisplay) {
            calculatorDisplay.value = currentInput;
        }
    }

    function inputDigit(digit) {
        if (waitingForSecondOperand) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateDisplay();
    }

    function inputDecimal(dot) {
        if (waitingForSecondOperand) {
            currentInput = '0.';
            waitingForSecondOperand = false;
            updateDisplay();
            return;
        }
        if (!currentInput.includes(dot)) {
            currentInput += dot;
            updateDisplay();
        }
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
        updateDisplay(); // Update display to show current result before next input
    }

    const performCalculation = {
        '/': (firstOperand, secondOperand) => firstOperand / secondOperand,
        '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
        '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
        '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
        '=': (firstOperand, secondOperand) => secondOperand // For equals, just return the second operand if no previous operator was active
    };

    function resetCalculator() {
        currentInput = '0';
        firstOperand = null;
        operator = null;
        waitingForSecondOperand = false;
        updateDisplay();
    }

    function clearLastEntry() {
        currentInput = '0';
        updateDisplay();
    }

    function backspace() {
        if (currentInput.length > 1) {
            currentInput = currentInput.slice(0, -1);
        } else {
            currentInput = '0';
        }
        updateDisplay();
    }

    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            const action = target.dataset.action;

            if (!target.matches('button')) {
                return;
            }

            if (target.classList.contains('digit')) {
                inputDigit(target.textContent);
                return;
            }

            if (target.classList.contains('decimal')) {
                inputDecimal(target.textContent);
                return;
            }

            if (target.classList.contains('operator')) {
                handleOperator(action);
                return;
            }

            if (action === 'clear') {
                resetCalculator();
                return;
            }

            if (action === 'backspace') {
                backspace();
                return;
            }

            if (action === 'calculate') {
                if (firstOperand === null || operator === null || waitingForSecondOperand) {
                    return; // Do nothing if no complete expression
                }
                const inputValue = parseFloat(currentInput);
                const result = performCalculation[operator](firstOperand, inputValue);
                currentInput = String(result);
                firstOperand = null; // Clear for next calculation
                operator = null; // Clear operator
                waitingForSecondOperand = true; // Ready for new input or chain operation
                updateDisplay();
                return;
            }
        });
    }

    // Open and Close Calculator
    if (openCalculatorFab) {
        openCalculatorFab.addEventListener('click', () => {
            if (calculatorOverlay) {
                calculatorOverlay.classList.add('active');
                resetCalculator(); // Reset calculator state when opening
                updateDisplay();
            }
        });
    }

    if (closeCalculatorButton) {
        closeCalculatorButton.addEventListener('click', () => {
            if (calculatorOverlay) {
                calculatorOverlay.classList.remove('active');
            }
        });
    }


    // --- Initialize functions based on current page ---
    if (document.getElementById('dashboard-page')) {
        updateDashboard();
    } else if (document.getElementById('transactions-page')) {
        const today = new Date();
        const monthButtons = document.querySelectorAll('.month-button');
        monthButtons.forEach(button => {
            if (parseInt(button.dataset.month) === currentMonth) {
                button.classList.add('active');
            }
        });

        const profileDateDisplay = document.getElementById('profileDateDisplay');
        if (profileDateDisplay) {
            const monthName = today.toLocaleDateString('en-US', { month: 'short' });
            const dayOfMonth = today.getDate();
            profileDateDisplay.innerHTML = `<span>${monthName}</span><span>${dayOfMonth}</span>`;
        }

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                currentMonth = parseInt(this.dataset.month);
                startDateInput.value = '';
                endDateInput.value = '';
                categoryFilterDropdown.value = '';
                transactionsCurrentPage = 1; // Reset to first page on month change
                renderTransactions();
                filterOptionsContainer.style.display = 'none';
            });
        });
        fetchAndProcessTransactions();
    } else if (document.getElementById('savings-page')) {
        updateSavingsPage();
    }

    // Handle add transaction fab click - opens Google Form
    const addTransactionFab = document.getElementById('addTransactionFab');
    if (addTransactionFab) {
        addTransactionFab.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

});
