document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';

    // --- Pagination Globals ---
    const ITEMS_PER_PAGE = 15;
    let currentTransactionsPage = 1;
    let currentSavingsPage = 1;
    let allTransactionsData = []; // Store all fetched data for consistent filtering and pagination
    let allSavingsDataGlobal = []; // Store all fetched savings data for pagination


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
        const lowerCaseType = type ? type.Type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                case 'savings contribution':
                case 'savings': // Also handle "savings" as a gain type
                    icon = '💰'; break;
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                case 'savings': // Handle "savings" as an expense type for deductions
                    icon = '📉'; // A distinct icon for savings deductions
                    break;
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
        mainMenuButton.addEventListener('click', () => mainMenuSidebar.classList.add('open'));
        closeSidebarButton.addEventListener('click', () => mainMenuSidebar.classList.remove('open'));
        document.addEventListener('click', (event) => {
            if (mainMenuSidebar.classList.contains('open') &&
                !mainMenuSidebar.contains(event.target) &&
                !mainMenuButton.contains(event.target)) {
                mainMenuSidebar.classList.remove('open');
            }
        });
    }

    // --- Dashboard Specific Logic (index.html) ---
    async function updateDashboard(filterMonth = 'All', filterYear = 'All') {
        if (!document.getElementById('dashboard-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);
            
            // Populate years for the filter dropdown
            const years = new Set();
            data.forEach(entry => {
                const entryDate = new Date(entry.Date);
                if (!isNaN(entryDate)) {
                    years.add(entryDate.getFullYear());
                }
            });
            const sortedYears = Array.from(years).sort((a, b) => b - a); // Sort descending
            const chartYearFilter = document.getElementById('chartYearFilter');
            if (chartYearFilter) {
                // Clear existing options except "All Years"
                chartYearFilter.innerHTML = '<option value="All">All Years</option>';
                sortedYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    chartYearFilter.appendChild(option);
                });
                // Set the current selected year if it's in the list
                if (filterYear !== 'All') {
                    chartYearFilter.value = filterYear;
                }
            }


            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;
            let totalSavingsAmount = 0;
            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0, 'Utility Bills': 0 };

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                const mapped = mapCategoryAndIcon(entry, entry['What kind?']);

                const entryDate = new Date(entry.Date);
                if (isNaN(amount) || !entryType || isNaN(entryDate)) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                const entryMonth = entryDate.getMonth() + 1; // 1-indexed month
                const entryYear = entryDate.getFullYear();

                const matchesMonth = (filterMonth === 'All' || entryMonth === parseInt(filterMonth));
                const matchesYear = (filterYear === 'All' || entryYear === parseInt(filterYear));

                if (!matchesMonth || !matchesYear) {
                    return; // Skip if it doesn't match the selected filters
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    // Accumulate for all categories for display in the chart data
                    if (mapped.category === 'Food') expenseCategoriesForChart.Food += amount;
                    else if (mapped.category === 'Medicines') expenseCategoriesForChart.Medicines += amount;
                    else if (mapped.category === 'Shopping') expenseCategoriesForChart.Shopping += amount;
                    else if (mapped.category === 'Utility Bills') expenseCategoriesForChart['Utility Bills'] += amount;
                    else expenseCategoriesForChart.Misc += amount; // Fallback for other expenses
                    
                    // Deduct from savings if it's an expense marked as 'savings'
                    if (entryWhatKind === 'savings') {
                        totalSavingsAmount -= amount;
                    }

                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                    // Add to totalSavingsAmount if it's a 'savings' or 'savings contribution' gain
                    if (entryWhatKind === 'savings contribution' || entryWhatKind === 'savings') {
                        totalSavingsAmount += amount;
                    }
                }
            });

            document.getElementById('netExpenseValue').textContent = formatCurrency(totalExpensesAmount);
            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount;
            document.getElementById('remainingBalanceAmount').textContent = `${formatCurrency(remainingBalance)} of ${formatCurrency(totalIncomeOrBudget)}`;
            let remainingBalancePercentage = totalIncomeOrBudget > 0 ? (remainingBalance / totalIncomeOrBudget) * 100 : 0;
            const displayPercentage = isNaN(remainingBalancePercentage) ? 0 : Math.round(remainingBalancePercentage);
            document.getElementById('remainingBalancePct').textContent = `${displayPercentage}%`;

            let progressOffset = 0;
            let progressColor = 'var(--accent-green)';
            const radius = 34;
            const circumference = 2 * Math.PI * radius;

            if (displayPercentage >= 100) progressOffset = 0;
            else if (displayPercentage > 0) {
                progressOffset = circumference - (displayPercentage / 100) * circumference;
                if (displayPercentage < 25) progressColor = 'var(--accent-red)';
                else if (displayPercentage < 50) progressColor = 'var(--accent-orange)';
            } else {
                progressOffset = circumference;
                progressColor = 'var(--accent-red)';
            }
            const progressCircle = document.querySelector('.progress-ring-progress');
            if (progressCircle) {
                progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
                progressCircle.style.strokeDashoffset = progressOffset;
                progressCircle.style.stroke = progressColor;
            }

            // Filter out categories with 0 amounts for chart and legend display
            const categoryNames = Object.keys(expenseCategoriesForChart).filter(cat => expenseCategoriesForChart[cat] > 0);
            const categoryAmounts = categoryNames.map(cat => expenseCategoriesForChart[cat]);
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Dynamically update legend percentages based on *filtered* total
            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('utilityBillsPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart['Utility Bills'] / totalCategoryExpenseForChart) * 100) : 0}%`;


            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) window.expenseChartInstance.destroy();

                const categoryColorMap = {
                    'Food': getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    'Medicines': getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    'Shopping': getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    'Misc': getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim(),
                    'Utility Bills': '#FFEB3B',
                };

                const chartBackgroundColors = categoryNames.map(cat => categoryColorMap[cat] || 'gray');

                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartBackgroundColors,
                            borderColor: 'var(--card-bg)',
                            borderWidth: 4,
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '80%',
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.parsed)}` } } }
                    }
                });
            }
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                savingsAmountSpan.dataset.actualAmount = totalSavingsAmount;
                savingsAmountSpan.textContent = formatCurrency(totalSavingsAmount);
            }
        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            // Handle errors gracefully
        }
    }

    const maskSavingsButton = document.getElementById('maskSavingsButton');
    if (maskSavingsButton) {
        maskSavingsButton.addEventListener('click', () => {
            const savingsAmountSpan = document.getElementById('savingsAmount');
            if (savingsAmountSpan) {
                if (savingsAmountSpan.textContent.includes('●')) {
                    savingsAmountSpan.textContent = formatCurrency(savingsAmountSpan.dataset.actualAmount || 0);
                    maskSavingsButton.textContent = 'Mask';
                } else {
                    savingsAmountSpan.textContent = '₱ ●●●,●●●.●●'; // Adjusted mask
                    maskSavingsButton.textContent = 'Show';
                }
            }
        });
    }

    // --- Filter for Donut Chart (Dashboard Page) - Month and Year ---
    const filterChartButton = document.getElementById('filterChartButton');
    const filterOptionsContainer = document.getElementById('filterOptionsContainer');
    const chartMonthFilter = document.getElementById('chartMonthFilter');
    const chartYearFilter = document.getElementById('chartYearFilter');

    if (filterChartButton && filterOptionsContainer && chartMonthFilter && chartYearFilter) {
        filterChartButton.addEventListener('click', () => {
            filterOptionsContainer.classList.toggle('open');
            filterChartButton.classList.toggle('active'); // Add/remove active class for arrow rotation
        });

        // Add change listeners for month and year filters
        chartMonthFilter.addEventListener('change', () => {
            const selectedMonth = chartMonthFilter.value;
            const selectedYear = chartYearFilter.value; // Get current year selection
            updateDashboard(selectedMonth, selectedYear);
            filterOptionsContainer.classList.remove('open'); // Close dropdown after selection
            filterChartButton.classList.remove('active'); // Reset arrow
        });

        chartYearFilter.addEventListener('change', () => {
            const selectedMonth = chartMonthFilter.value; // Get current month selection
            const selectedYear = chartYearFilter.value;
            updateDashboard(selectedMonth, selectedYear);
            filterOptionsContainer.classList.remove('open'); // Close dropdown after selection
            filterChartButton.classList.remove('active'); // Reset arrow
        });


        // Close dropdown if clicked outside
        document.addEventListener('click', (event) => {
            if (!filterOptionsContainer.contains(event.target) && !filterChartButton.contains(event.target) && filterOptionsContainer.classList.contains('open')) {
                filterOptionsContainer.classList.remove('open');
                filterChartButton.classList.remove('active');
            }
        });
    }


    // --- Generic Pagination Setup ---
    function setupPaginationControls(containerElement, totalPages, currentPage, onPageChangeCallback) {
        containerElement.innerHTML = ''; // Clear existing controls
        if (totalPages <= 1) return;

        const createButton = (text, page, isDisabled = false, isActive = false, isEllipsis = false) => {
            const button = document.createElement(isEllipsis ? 'span' : 'button');
            button.textContent = text;
            if (!isEllipsis) {
                button.disabled = isDisabled;
                if (isActive) button.classList.add('active');
                button.addEventListener('click', () => {
                    if (!isDisabled) onPageChangeCallback(page);
                });
            } else {
                button.style.padding = '8px 12px'; // Match button padding
                button.style.color = 'var(--text-light)';
            }
            return button;
        };

        // Previous Button
        containerElement.appendChild(createButton('Previous', currentPage - 1, currentPage === 1));

        // Page Number Buttons (with ellipsis for many pages)
        const maxPagesToShow = 5; // Max number of direct page buttons
        if (totalPages <= maxPagesToShow + 2) { // Show all if not too many
            for (let i = 1; i <= totalPages; i++) {
                containerElement.appendChild(createButton(i, i, false, i === currentPage));
            }
        } else {
            containerElement.appendChild(createButton(1, 1, false, 1 === currentPage)); // First page
            if (currentPage > 3) {
                containerElement.appendChild(createButton('...', 0, false, false, true)); // Ellipsis
            }

            let startPage = Math.max(2, currentPage - 1);
            let endPage = Math.min(totalPages - 1, currentPage + 1);

            if (currentPage <= 3) {
                endPage = Math.min(totalPages -1, maxPagesToShow -1); // Show 1, 2, 3, ..., last
            }
            if (currentPage >= totalPages - 2) {
                startPage = Math.max(2, totalPages - (maxPagesToShow - 2) ); // Show 1, ..., last-2, last-...
            }

            for (let i = startPage; i <= endPage; i++) {
                containerElement.appendChild(createButton(i, i, false, i === currentPage));
            }

            if (currentPage < totalPages - 2) {
                containerElement.appendChild(createButton('...', 0, false, false, true)); // Ellipsis
            }
            containerElement.appendChild(createButton(totalPages, totalPages, false, totalPages === currentPage)); // Last page
        }

        // Next Button
        containerElement.appendChild(createButton('Next', currentPage + 1, currentPage === totalPages));
    }


    // --- Transactions Page Specific Logic (transactions.html) ---
    async function fetchAndProcessTransactions() {
        if (!document.getElementById('transactions-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv);
            populateCategoryFilter(); // Populate filter dropdown after data is fetched

            // Set current month button as active on load
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // getMonth() is 0-indexed
            const monthButtons = document.querySelectorAll('.months-nav .month-button');
            monthButtons.forEach(button => {
                if (parseInt(button.dataset.month) === currentMonth) {
                    button.classList.add('active');
                }
            });
            renderTransactions(currentMonth); // Initial render
        } catch (error) {
            console.error('Error fetching or processing CSV for transactions:', error);
            const transactionsListDiv = document.getElementById('transactionsList');
            if (transactionsListDiv) transactionsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading transactions.</p>';
        }
    }

    function populateCategoryFilter() {
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        if (!categoryFilterDropdown) return;

        categoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';
        const uniqueCategories = new Set();
        allTransactionsData.forEach(entry => {
            if (entry['What kind?']) uniqueCategories.add(entry['What kind?'].trim());
            // Also add the 'Type' as a category for filtering (e.g., "Gains")
            if (entry.Type) uniqueCategories.add(entry.Type.trim());
        });

        // Add hardcoded categories if they are always expected
        ['Food', 'Medicines', 'Shopping', 'Transportation', 'Utility Bills', 'Misc', 'Salary', 'Allowance', 'Savings Contribution', 'Savings', 'Gains', 'Expenses'].forEach(cat => uniqueCategories.add(cat));


        Array.from(uniqueCategories).sort().forEach(category => {
            if (category) { // Ensure category is not empty
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilterDropdown.appendChild(option);
            }
        });
    }

    function renderTransactions(month = null, category = '', startDate = '', endDate = '') {
        const transactionsListDiv = document.getElementById('transactionsList');
        const paginationControlsDiv = document.getElementById('transactionsPagination');
        if (!transactionsListDiv || !paginationControlsDiv) return;

        let filteredData = allTransactionsData.filter(entry => {
            const entryDate = new Date(entry.Date);
            const entryMonth = entryDate.getMonth() + 1; // JavaScript months are 0-indexed
            const entryCategory = entry['What kind?'] ? entry['What kind?'].trim() : '';
            const entryType = entry.Type ? entry.Type.trim() : '';

            // Month filter
            const matchesMonth = (month === null || entryMonth === month);

            // Category filter
            const matchesCategory = (!category ||
                entryCategory.toLowerCase() === category.toLowerCase() ||
                entryType.toLowerCase() === category.toLowerCase() // Allow filtering by 'Type' as well
            );

            // Date range filter
            const matchesStartDate = (!startDate || entryDate >= new Date(startDate));
            const matchesEndDate = (!endDate || entryDate <= new Date(endDate));

            return matchesMonth && matchesCategory && matchesStartDate && matchesEndDate;
        }).sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc

        const totalItems = filteredData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (currentTransactionsPage > totalPages && totalPages > 0) currentTransactionsPage = totalPages;
        if (currentTransactionsPage < 1 && totalPages > 0) currentTransactionsPage = 1;
        else if (totalPages === 0) currentTransactionsPage = 1;

        const startIndex = (currentTransactionsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        transactionsListDiv.innerHTML = ''; // Clear previous items

        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date + 'T00:00:00'); // Ensure date is parsed consistently
            const dateKey = entryDate.toDateString();

            if (!groupedTransactions[dateKey]) {
                groupedTransactions[dateKey] = [];
            }
            groupedTransactions[dateKey].push(entry);
        });

        // Sort dates in descending order for display
        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(dateKey => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeader = document.createElement('div');
            dateHeader.classList.add('transaction-date-header');
            const displayDate = new Date(dateKey);

            if (displayDate.toDateString() === today.toDateString()) {
                dateHeader.textContent = 'Today';
            } else if (displayDate.toDateString() === yesterday.toDateString()) {
                dateHeader.textContent = 'Yesterday';
            } else {
                dateHeader.textContent = displayDate.toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
            }
            groupDiv.appendChild(dateHeader);

            groupedTransactions[dateKey].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry, entry['What kind?']);

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('transaction-icon');
                iconSpan.textContent = icon;
                itemDiv.appendChild(iconSpan);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description;
                detailsDiv.appendChild(nameSpan);

                const categorySpan = document.createElement('span');
                categorySpan.classList.add('transaction-category');
                categorySpan.textContent = category;
                detailsDiv.appendChild(categorySpan);

                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type.toLowerCase() === 'expenses') amountSpan.classList.add('expense');
                else if (entry.Type.toLowerCase() === 'gains') amountSpan.classList.add('gain');
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            transactionsListDiv.appendChild(groupDiv);
        });

        if (paginatedData.length === 0) {
            transactionsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No transactions found for ${totalItems > 0 ? 'this page.' : 'the selected filters.'}</p>`;
        }

        setupPaginationControls(paginationControlsDiv, totalPages, currentTransactionsPage, (newPage) => {
            currentTransactionsPage = newPage;
            // Get current filter values to pass them again
            const currentCat = document.getElementById('categoryFilterDropdown').value;
            const currentStart = document.getElementById('startDateInput').value;
            const currentEnd = document.getElementById('endDateInput').value;
            const activeMonthButton = document.querySelector('.months-nav .month-button.active');
            const currentMonth = activeMonthButton ? parseInt(activeMonthButton.dataset.month) : null;
            renderTransactions(currentMonth, currentCat, currentStart, currentEnd);
        });
    }

    // --- Savings Page Specific Logic (savings.html) ---
    async function updateSavingsPage() {
        if (!document.getElementById('savings-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);
            allSavingsDataGlobal = []; // Clear previous data

            let totalSavingsAmount = 0;

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount)) {
                    console.warn('Savings Page - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'gains' && (entryWhatKind === 'savings' || entryWhatKind === 'savings contribution')) {
                    totalSavingsAmount += amount;
                    allSavingsDataGlobal.push(entry);
                } else if (entryType === 'expenses' && entryWhatKind === 'savings') {
                    totalSavingsAmount -= amount;
                    allSavingsDataGlobal.push(entry); // Still add as a savings-related transaction
                }
            });

            document.getElementById('totalSavingsAmount').textContent = formatCurrency(totalSavingsAmount);
            renderSavingsTransactions(); // Initial render of savings transactions
        } catch (error) {
            console.error('Error fetching or processing CSV for savings page:', error);
            document.getElementById('totalSavingsAmount').textContent = '₱ Error';
            document.getElementById('savingsTransactionsList').innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading savings transactions.</p>';
        }
    }

    function renderSavingsTransactions() {
        const savingsListDiv = document.getElementById('savingsTransactionsList');
        const paginationControlsDiv = document.getElementById('savingsPagination');
        if (!savingsListDiv || !paginationControlsDiv) return;

        // Sort savings transactions by date descending
        const sortedSavingsData = allSavingsDataGlobal.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        const totalItems = sortedSavingsData.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (currentSavingsPage > totalPages && totalPages > 0) currentSavingsPage = totalPages;
        if (currentSavingsPage < 1 && totalPages > 0) currentSavingsPage = 1;
        else if (totalPages === 0) currentSavingsPage = 1;

        const startIndex = (currentSavingsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedData = sortedSavingsData.slice(startIndex, endIndex);

        savingsListDiv.innerHTML = ''; // Clear previous items

        // Grouping and rendering logic (similar to renderTransactions)
        const groupedTransactions = {};
        const today = new Date();
        today.setHours(0,0,0,0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date + 'T00:00:00');
            const dateKey = entryDate.toDateString();

            if (!groupedTransactions[dateKey]) {
                groupedTransactions[dateKey] = [];
            }
            groupedTransactions[dateKey].push(entry);
        });

        const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(dateKey => {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('transaction-group');

            const dateHeader = document.createElement('div');
            dateHeader.classList.add('transaction-date-header');
            const displayDate = new Date(dateKey);

            if (displayDate.toDateString() === today.toDateString()) {
                dateHeader.textContent = 'Today';
            } else if (displayDate.toDateString() === yesterday.toDateString()) {
                dateHeader.textContent = 'Yesterday';
            } else {
                dateHeader.textContent = displayDate.toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
            }
            groupDiv.appendChild(dateHeader);

            groupedTransactions[dateKey].forEach(entry => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('transaction-item');

                const { category, icon } = mapCategoryAndIcon(entry, entry['What kind?']);

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('transaction-icon');
                iconSpan.textContent = icon;
                itemDiv.appendChild(iconSpan);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('transaction-details');

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description;
                detailsDiv.appendChild(nameSpan);

                const categorySpan = document.createElement('span');
                categorySpan.classList.add('transaction-category');
                categorySpan.textContent = category;
                detailsDiv.appendChild(categorySpan);

                itemDiv.appendChild(detailsDiv);

                const amountSpan = document.createElement('span');
                amountSpan.classList.add('transaction-amount');
                amountSpan.textContent = formatCurrency(entry.Amount);
                if (entry.Type.toLowerCase() === 'expenses') amountSpan.classList.add('expense');
                else if (entry.Type.toLowerCase() === 'gains') amountSpan.classList.add('gain');
                itemDiv.appendChild(amountSpan);

                groupDiv.appendChild(itemDiv);
            });
            savingsListDiv.appendChild(groupDiv);
        });

        if (paginatedData.length === 0) {
            savingsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No savings transactions found.</p>`;
        }

        setupPaginationControls(paginationControlsDiv, totalPages, currentSavingsPage, (newPage) => {
            currentSavingsPage = newPage;
            renderSavingsTransactions();
        });
    }

    // --- Add Transaction FAB & Calculator Logic ---
    const addTransactionFab = document.getElementById('addTransactionFab');
    if (addTransactionFab) {
        addTransactionFab.addEventListener('click', () => {
            window.open(GOOGLE_FORM_URL, '_blank');
        });
    }

    const openCalculatorFab = document.getElementById('openCalculatorFab');
    const calculatorOverlay = document.getElementById('calculatorOverlay');
    const closeCalculatorButton = document.getElementById('closeCalculatorButton');
    const calculatorDisplay = document.getElementById('calculatorDisplay');
    const calculatorButtons = document.querySelector('.calculator-buttons');

    let currentInput = '0';
    let operator = null;
    let firstOperand = null;
    let waitingForSecondOperand = false;

    function updateDisplay() {
        calculatorDisplay.value = currentInput;
    }

    function resetCalculator() {
        currentInput = '0';
        operator = null;
        firstOperand = null;
        waitingForSecondOperand = false;
    }

    function handleNumber(number) {
        if (waitingForSecondOperand) {
            currentInput = number;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? number : currentInput + number;
        }
        updateDisplay();
    }

    function handleDecimal() {
        if (!currentInput.includes('.')) {
            currentInput += '.';
        }
        updateDisplay();
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
        updateDisplay();
    }

    const performCalculation = {
        '/': (first, second) => first / second,
        '*': (first, second) => first * second,
        '+': (first, second) => first + second,
        '-': (first, second) => first - second,
    };

    if (openCalculatorFab && calculatorOverlay && closeCalculatorButton && calculatorDisplay && calculatorButtons) {
        openCalculatorFab.addEventListener('click', () => {
            calculatorOverlay.classList.add('open');
            resetCalculator();
        });

        closeCalculatorButton.addEventListener('click', () => {
            calculatorOverlay.classList.remove('open');
        });

        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) return;

            if (target.classList.contains('digit')) {
                handleNumber(target.textContent);
                return;
            }

            if (target.classList.contains('decimal')) {
                handleDecimal();
                return;
            }

            if (target.classList.contains('operator')) {
                handleOperator(target.dataset.action);
                return;
            }

            if (target.classList.contains('equals')) {
                if (operator && firstOperand !== null) {
                    const result = performCalculation[operator](firstOperand, parseFloat(currentInput));
                    currentInput = String(result);
                    firstOperand = null;
                    operator = null;
                    waitingForSecondOperand = false;
                    updateDisplay();
                }
                return;
            }

            if (target.classList.contains('clear')) {
                resetCalculator();
                updateDisplay();
                return;
            }

            if (target.classList.contains('backspace')) {
                currentInput = currentInput.slice(0, -1) || '0';
                updateDisplay();
                return;
            }
        });

        // Initialize display
        updateDisplay();
    }

    // --- Page specific initializations ---
    if (document.getElementById('dashboard-page')) {
        updateDashboard(); // Call with default 'All' for month and year
    } else if (document.getElementById('transactions-page')) {
        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        const monthButtons = document.querySelectorAll('.months-nav .month-button');

        if (filterButton && filterOptionsContainer) {
            filterButton.addEventListener('click', () => {
                filterOptionsContainer.classList.toggle('open');
            });

            document.addEventListener('click', (event) => {
                if (!filterOptionsContainer.contains(event.target) && !filterButton.contains(event.target) && filterOptionsContainer.classList.contains('open')) {
                    filterOptionsContainer.classList.remove('open');
                }
            });
        }

        if (applyFiltersButton && categoryFilterDropdown && startDateInput && endDateInput) {
            applyFiltersButton.addEventListener('click', () => {
                const selectedCategory = categoryFilterDropdown.value;
                const selectedStartDate = startDateInput.value;
                const selectedEndDate = endDateInput.value;
                currentTransactionsPage = 1; // Reset page on filter change
                monthButtons.forEach(btn => btn.classList.remove('active')); // Deactivate month buttons
                renderTransactions(null, selectedCategory, selectedStartDate, selectedEndDate);
                filterOptionsContainer.classList.remove('open'); // Close filter options
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page for initial load
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                const today = new Date(); const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month=\"${currentMonth}\"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
                renderTransactions(currentMonth);
                if(filterOptionsContainer) filterOptionsContainer.classList.remove('open'); // Ensure filter options container closes
            });
        }

        monthButtons.forEach(button => {
            button.addEventListener('click', function() {
                currentTransactionsPage = 1; // Reset page
                monthButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                const selectedMonth = parseInt(this.dataset.month);
                // Clear other filters when a month is selected
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                renderTransactions(selectedMonth);
                if(filterOptionsContainer) filterOptionsContainer.classList.remove('open');
            });
        });

        fetchAndProcessTransactions(); // Initial fetch and render
    } else if (document.getElementById('savings-page')) {
        updateSavingsPage();
    }
});
