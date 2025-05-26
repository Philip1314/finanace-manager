document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEh-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';
    // SAVINGS_GOAL_KEY is no longer needed for savings page display logic

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
        const lowerCaseType = type ? type.toLowerCase() : '';

        if (lowerCaseType === 'gains') {
            category = 'Gain';
            switch (lowerCaseWhatKind) {
                case 'salary': icon = '💸'; break;
                case 'allowance': icon = '🎁'; break;
                case 'savings': icon = '💰'; break; // Changed from 'savings contribution' to 'savings'
                default: icon = '💰'; break;
            }
        } else if (lowerCaseType === 'expenses') {
            switch (lowerCaseWhatKind) {
                case 'food': case 'groceries': category = 'Food'; icon = '🍔'; break;
                case 'medicines': category = 'Medicines'; icon = '💊'; break;
                case 'online shopping': category = 'Shopping'; icon = '🛍️'; break;
                case 'transportation': category = 'Transportation'; icon = '🚌'; break;
                case 'utility bills': category = 'Utility Bills'; icon = '💡'; break;
                // Removed 'allowance' mapping to 'Misc' for expenses as it could be ambiguous with gains. Default is 'Misc'.
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
    async function updateDashboard() {
        if (!document.getElementById('dashboard-page')) return;
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const data = parseCSV(csv);

            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;
            let totalSavingsAmount = 0;
            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0, Transportation: 0, 'Utility Bills': 0 }; // Added more categories

            data.forEach(entry => {
                const amount = parseFloat(entry.Amount);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || !entryType) { // Removed !entryWhatKind check as it might be empty for some valid entries
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return;
                }

                if (entryType === 'expenses') {
                    totalExpensesAmount += amount;
                    if (entryWhatKind === 'food' || entryWhatKind === 'groceries') expenseCategoriesForChart.Food += amount;
                    else if (entryWhatKind === 'medicines') expenseCategoriesForChart.Medicines += amount;
                    else if (entryWhatKind === 'online shopping') expenseCategoriesForChart.Shopping += amount;
                    else if (entryWhatKind === 'transportation') expenseCategoriesForChart.Transportation += amount;
                    else if (entryWhatKind === 'utility bills') expenseCategoriesForChart['Utility Bills'] += amount;
                    else expenseCategoriesForChart.Misc += amount;
                } else if (entryType === 'gains') {
                    totalGainsAmount += amount;
                    if (entryWhatKind === 'savings') totalSavingsAmount += amount; // Changed from 'savings contribution' to 'savings'
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

            // Update chart logic for potentially more categories
            const categoryNames = Object.keys(expenseCategoriesForChart).filter(cat => expenseCategoriesForChart[cat] > 0); // Only show categories with expenses
            const categoryAmounts = categoryNames.map(cat => expenseCategoriesForChart[cat]);
            const totalCategoryExpenseForChart = categoryAmounts.reduce((sum, amount) => sum + amount, 0);

            // Dynamically update legend percentages - simplified example, you might want all categories in legend
            document.getElementById('foodPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Food / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('medicinesPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Medicines / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('shoppingPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Shopping / totalCategoryExpenseForChart) * 100) : 0}%`;
            document.getElementById('miscPct').textContent = `${totalCategoryExpenseForChart > 0 ? Math.round((expenseCategoriesForChart.Misc / totalCategoryExpenseForChart) * 100) : 0}%`;


            const ctx = document.getElementById('expenseChart');
            if (ctx) {
                if (window.expenseChartInstance) window.expenseChartInstance.destroy();
                const chartColors = [ // Ensure enough colors if more categories are prominent
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-red').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim(),
                    getComputedStyle(document.documentElement).getPropertyValue('--accent-purple').trim(), // Added purple
                    '#FFEB3B', // Yellow
                ];
                window.expenseChartInstance = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: categoryNames,
                        datasets: [{
                            data: categoryAmounts,
                            backgroundColor: chartColors.slice(0, categoryNames.length),
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
                startPage = Math.max(2, totalPages - (maxPagesToShow - 2) ); // Show 1, ..., last-2, last-1, last
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
        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            allTransactionsData = parseCSV(csv); // Store raw data globally

            populateCategoryFilter();
            const today = new Date();
            let initialMonth = today.getMonth() + 1;

            // Set initial active month button
            const monthButtons = document.querySelectorAll('.months-nav .month-button');
            monthButtons.forEach(button => {
                button.classList.remove('active');
                if (parseInt(button.dataset.month) === initialMonth) {
                    button.classList.add('active');
                }
            });
            currentTransactionsPage = 1; // Reset page for initial load
            renderTransactions(initialMonth); // Initial render
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
            if (entry.Type) uniqueCategories.add(entry.Type.trim()); // Add "Gains" and "Expenses" as main types
        });

        const sortedCategories = Array.from(uniqueCategories).sort();
        const prioritized = [];
        if (sortedCategories.includes('Gains')) { prioritized.push('Gains'); sortedCategories.splice(sortedCategories.indexOf('Gains'), 1); }
        if (sortedCategories.includes('Expenses')) { prioritized.push('Expenses'); sortedCategories.splice(sortedCategories.indexOf('Expenses'), 1); }
        
        prioritized.push(...sortedCategories.filter(cat => !['salary', 'allowance', 'savings'].includes(cat.toLowerCase()))); // Avoid redundant sub-categories if "Gains" is chosen

        prioritized.forEach(category => {
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
        const paginationControlsDiv = document.getElementById('transactionsPaginationControls');
        if (!transactionsListDiv || !paginationControlsDiv) return;

        let filteredData = allTransactionsData.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date); // CSV Date
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            // const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

            if (isNaN(amount) || isNaN(date.getTime()) || !entryType) { // Check date validity
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            const entryDate = new Date(entry.Date); // Use entry.Date directly
            entryDate.setHours(0, 0, 0, 0);

            if (selectedMonth && !startDate && !endDate && entryDate.getMonth() + 1 !== selectedMonth) return false;

            if (selectedCategory) {
                const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                const actualCategoryInEntry = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';
                const entryCategoryType = entry.Type ? entry.Type.toLowerCase() : '';

                if (lowerCaseSelectedCategory === 'gains') { if (entryCategoryType !== 'gains') return false; }
                else if (lowerCaseSelectedCategory === 'expenses') { if (entryCategoryType !== 'expenses') return false; }
                else if (actualCategoryInEntry !== lowerCaseSelectedCategory && entryCategoryType !== lowerCaseSelectedCategory) return false; // Check against 'What kind?' or main type
            }

            if (startDate && endDate) {
                const start = new Date(startDate); start.setHours(0, 0, 0, 0);
                const end = new Date(endDate); end.setHours(23, 59, 59, 999);
                if (entryDate < start || entryDate > end) return false;
            }
            return true;
        });

        filteredData.sort((a, b) => new Date(b.Date) - new Date(a.Date)); // Sort by date desc

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
        const today = new Date(); today.setHours(0,0,0,0);
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date); entryDate.setHours(0,0,0,0);
            let dateHeader;
            if (entryDate.getTime() === today.getTime()) dateHeader = 'Today';
            else if (entryDate.getTime() === yesterday.getTime()) dateHeader = 'Yesterday';
            else dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            if (!groupedTransactions[dateHeader]) groupedTransactions[dateHeader] = [];
            groupedTransactions[dateHeader].push(entry);
        });

        Object.keys(groupedTransactions).sort((a,b) => { /* existing sort logic */
            if (a === 'Today') return -1; if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1; if (b === 'Yesterday') return 1;
            return new Date(b) - new Date(a);
        }).forEach(dateHeader => {
            const groupDiv = document.createElement('div'); groupDiv.classList.add('transaction-group');
            const headerDiv = document.createElement('div'); headerDiv.classList.add('transaction-date-header'); headerDiv.textContent = dateHeader;
            groupDiv.appendChild(headerDiv);
            groupedTransactions[dateHeader].sort((a,b) => { /* time sort */
                const timeA = a.Time ? a.Time.split(':').map(Number) : [0,0,0];
                const timeB = b.Time ? b.Time.split(':').map(Number) : [0,0,0];
                if(timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
                if(timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
                return timeA[2] - timeB[2];
            }).forEach(entry => {
                const itemDiv = document.createElement('div'); itemDiv.classList.add('transaction-item');
                const categoryIconDiv = document.createElement('div'); categoryIconDiv.classList.add('transaction-category-icon');
                const { category: mappedCategory, icon: categoryIcon } = mapCategoryAndIcon(entry.Type, entry['What kind?']);
                if (entry.Type.toLowerCase() === 'gains') categoryIconDiv.classList.add('category-gain');
                else {
                    switch (mappedCategory.toLowerCase()) {
                        case 'food': categoryIconDiv.classList.add('category-food'); break;
                        case 'medicines': categoryIconDiv.classList.add('category-medicines'); break;
                        case 'shopping': categoryIconDiv.classList.add('category-shopping'); break;
                        default: categoryIconDiv.classList.add('category-misc'); break;
                    }
                }
                categoryIconDiv.textContent = categoryIcon; itemDiv.appendChild(categoryIconDiv);
                const detailsDiv = document.createElement('div'); detailsDiv.classList.add('transaction-details');
                const nameSpan = document.createElement('span'); nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description || entry['What kind?'] || 'N/A'; detailsDiv.appendChild(nameSpan);
                const timeSpan = document.createElement('span'); timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || ''; detailsDiv.appendChild(timeSpan);
                itemDiv.appendChild(detailsDiv);
                const amountSpan = document.createElement('span'); amountSpan.classList.add('transaction-amount');
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
            const activeMonthBtn = document.querySelector('.months-nav .month-button.active');
            const currentSelMonth = activeMonthBtn ? parseInt(activeMonthBtn.dataset.month) : null;
            const finalMonthToPass = (currentStart || currentEnd) ? null : currentSelMonth;
            renderTransactions(finalMonthToPass, currentCat, currentStart, currentEnd);
        });
    }

    // --- Savings Page Specific Logic (savings.html) ---
    async function updateSavingsPage() {
        if (!document.getElementById('savings-page')) return;
        const totalSavingsAmountSpan = document.getElementById('totalSavingsAmount');

        try {
            const response = await fetch(CSV_URL);
            const csv = await response.text();
            const allData = parseCSV(csv);

            let overallTotalSavings = 0;
            allSavingsDataGlobal = allData.filter(entry => { // Store filtered data globally for pagination
                const amount = parseFloat(entry.Amount);
                const isSavings = entry.Type && entry.Type.toLowerCase() === 'gains' &&
                                  entry['What kind?'] && entry['What kind?'].toLowerCase() === 'savings' && // Changed from 'savings contribution' to 'savings'
                                  !isNaN(amount);
                if (isSavings) overallTotalSavings += amount;
                return isSavings;
            });

            if (totalSavingsAmountSpan) totalSavingsAmountSpan.textContent = formatCurrency(overallTotalSavings);
            
            currentSavingsPage = 1; // Reset page on initial load/update
            renderSavingsEntries(); // Call render function (it will use allSavingsDataGlobal)

        } catch (error) {
            console.error('Error fetching or processing CSV for savings page:', error);
            if (totalSavingsAmountSpan) totalSavingsAmountSpan.textContent = '₱ Error';
            const savingsListDiv = document.getElementById('savingsTransactionsList');
            if (savingsListDiv) savingsListDiv.innerHTML = '<p style="text-align: center; color: var(--accent-red); padding: 2rem;">Error loading savings data.</p>';
        }
    }

    function renderSavingsEntries() { // Uses global allSavingsDataGlobal and currentSavingsPage
        const savingsListDiv = document.getElementById('savingsTransactionsList');
        const paginationControlsDiv = document.getElementById('savingsPaginationControls');
        if (!savingsListDiv || !paginationControlsDiv) return;

        // Data is already filtered and stored in allSavingsDataGlobal
        const sortedSavingsData = [...allSavingsDataGlobal].sort((a, b) => new Date(b.Date) - new Date(a.Date));

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
        const today = new Date(); today.setHours(0,0,0,0);
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

        paginatedData.forEach(entry => {
            const entryDate = new Date(entry.Date); entryDate.setHours(0,0,0,0);
            let dateHeader;
            if (entryDate.getTime() === today.getTime()) dateHeader = 'Today';
            else if (entryDate.getTime() === yesterday.getTime()) dateHeader = 'Yesterday';
            else dateHeader = entryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            if (!groupedTransactions[dateHeader]) groupedTransactions[dateHeader] = [];
            groupedTransactions[dateHeader].push(entry);
        });

        Object.keys(groupedTransactions).sort((a,b) => {
             if (a === 'Today') return -1; if (b === 'Today') return 1;
             if (a === 'Yesterday') return -1; if (b === 'Yesterday') return 1;
             return new Date(b) - new Date(a); // Sort by date desc
        }).forEach(dateHeader => {
            const groupDiv = document.createElement('div'); groupDiv.classList.add('transaction-group');
            const headerDiv = document.createElement('div'); headerDiv.classList.add('transaction-date-header'); headerDiv.textContent = dateHeader;
            groupDiv.appendChild(headerDiv);
            groupedTransactions[dateHeader].sort((a,b) => { /* time sort */
                const timeA = a.Time ? a.Time.split(':').map(Number) : [0,0,0];
                const timeB = b.Time ? b.Time.split(':').map(Number) : [0,0,0];
                if(timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
                if(timeA[1] !== timeB[1]) return timeA[1] - timeB[1];
                return timeA[2] - timeB[2];
            }).forEach(entry => {
                const itemDiv = document.createElement('div'); itemDiv.classList.add('transaction-item');
                const categoryIconDiv = document.createElement('div'); categoryIconDiv.classList.add('transaction-category-icon', 'category-gain');
                categoryIconDiv.textContent = '💰'; itemDiv.appendChild(categoryIconDiv);
                const detailsDiv = document.createElement('div'); detailsDiv.classList.add('transaction-details');
                const nameSpan = document.createElement('span'); nameSpan.classList.add('transaction-name');
                nameSpan.textContent = entry.Description || 'Savings Contribution'; detailsDiv.appendChild(nameSpan);
                const timeSpan = document.createElement('span'); timeSpan.classList.add('transaction-time');
                timeSpan.textContent = entry.Time || ''; detailsDiv.appendChild(timeSpan);
                itemDiv.appendChild(detailsDiv);
                const amountSpan = document.createElement('span'); amountSpan.classList.add('transaction-amount', 'gain');
                amountSpan.textContent = formatCurrency(entry.Amount); itemDiv.appendChild(amountSpan);
                groupDiv.appendChild(itemDiv);
            });
            savingsListDiv.appendChild(groupDiv);
        });
        
        if (paginatedData.length === 0) {
            savingsListDiv.innerHTML = `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No savings contributions ${totalItems > 0 ? 'on this page.' : 'found.'}</p>`;
        }

        setupPaginationControls(paginationControlsDiv, totalPages, currentSavingsPage, (newPage) => {
            currentSavingsPage = newPage;
            renderSavingsEntries();
        });
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

    function updateDisplay() { if(calculatorDisplay) calculatorDisplay.value = currentInput; }
    function resetCalculator() {
        currentInput = '0';
        firstOperand = null;
        operator = null;
        waitingForSecondOperand = false;
    }

    function inputDigit(digit) {
        if (currentInput === 'Error') currentInput = '0'; // Clear error on new digit
        if (waitingForSecondOperand) {
            currentInput = digit;
            waitingForSecondOperand = false;
        } else {
            currentInput = currentInput === '0' ? digit : currentInput + digit;
        }
        updateDisplay();
    }

    function inputDecimal(dot) {
        if (currentInput === 'Error') currentInput = '0.'; // Clear error
        if (waitingForSecondOperand) {
            currentInput = '0.';
            waitingForSecondOperand = false;
            updateDisplay(); return;
        }
        if (!currentInput.includes(dot)) currentInput += dot;
        updateDisplay();
    }

    // ***** CALCULATOR FIX: Changed keys in performCalculation *****
    const performCalculation = {
        'divide': (first, second) => second === 0 ? 'Error' : first / second,
        'multiply': (first, second) => first * second,
        'add': (first, second) => first + second,
        'subtract': (first, second) => first - second,
    };

    function handleOperator(nextOperator) {
        if (currentInput === 'Error' && nextOperator) { // If error, pressing an operator might mean user wants to use last good firstOperand
             if (firstOperand !== null) { // If there was a valid first operand before error
                currentInput = String(firstOperand); // Restore it
                waitingForSecondOperand = false; // Allow it to be part of new op
             } else { // No valid firstOperand, so reset
                resetCalculator();
                updateDisplay();
                // Operator cannot be processed if no first operand from error state.
                return;
             }
        }

        const inputValue = parseFloat(currentInput);
        if (isNaN(inputValue)) { // If current input is not a number (e.g. after an error not cleared by digit)
            // Potentially an error state, or waiting for second operand.
            // If operator is already set, and waitingForSecondOperand is true, allow changing operator
            if (operator && waitingForSecondOperand) {
                 operator = nextOperator;
                 return;
            }
            // Otherwise, don't proceed if input is NaN
            console.warn("Calculator: Input is NaN, cannot process operator.");
            return;
        }


        if (operator && waitingForSecondOperand) {
            operator = nextOperator; return;
        }
        if (firstOperand === null) {
            firstOperand = inputValue;
        } else if (operator) {
            const result = performCalculation[operator](firstOperand, inputValue);
            if (result === 'Error' || isNaN(result)) {
                currentInput = 'Error';
                firstOperand = null; // Reset on error
                operator = null;
                waitingForSecondOperand = true; // Expect a new start
            } else {
                currentInput = String(parseFloat(result.toFixed(7))); // Limit precision
                firstOperand = parseFloat(currentInput); // Store result as new firstOperand
            }
        }
        waitingForSecondOperand = true;
        operator = nextOperator;
        updateDisplay();
    }


    if (calculatorButtons) {
        calculatorButtons.addEventListener('click', (event) => {
            const { target } = event;
            if (!target.matches('button')) return;
            const action = target.dataset.action;

            if (target.classList.contains('operator')) { handleOperator(action); return; }
            if (target.classList.contains('decimal')) { inputDecimal('.'); return; } // Use '.' directly
            if (action === 'clear') { resetCalculator(); updateDisplay(); return; }
            if (action === 'backspace') {
                if (currentInput === 'Error') { resetCalculator(); }
                else { currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : '0';}
                updateDisplay(); return;
            }
            if (action === 'calculate') {
                if (operator === null || firstOperand === null) return; // Nothing to calculate if no operator or first operand
                
                // If waitingForSecondOperand is true, it means an operator was just pressed.
                // Standard behavior: use currentInput (which might be the first operand again) as second.
                // e.g., 5 + = should be 5 + 5.
                // My currentInput is already set correctly before hitting equals if a second number was typed.
                // If an operator was the last thing pressed, waitingForSecondOperand is true.
                // inputValue will take currentInput.
                
                const inputValue = parseFloat(currentInput);
                if (isNaN(inputValue) && currentInput !== 'Error') { // Handle if currentInput became NaN somehow
                    currentInput = 'Error';
                    firstOperand = null;
                    operator = null;
                    waitingForSecondOperand = true;
                    updateDisplay();
                    return;
                }

                if (currentInput === 'Error') return; // Don't calculate if display is Error

                let result = performCalculation[operator](firstOperand, inputValue);
                if (result === 'Error' || isNaN(result)) {
                    currentInput = 'Error';
                } else {
                    currentInput = String(parseFloat(result.toFixed(7))); // Limit precision
                }
                // After equals, some calculators chain (result becomes firstOperand, new operator can be hit)
                // Others fully reset. Let's allow chaining for now by setting firstOperand.
                firstOperand = parseFloat(currentInput); // If not error, result is new firstOperand
                if (currentInput === 'Error') firstOperand = null;

                operator = null; // Clear operator for next independent calculation unless chained
                waitingForSecondOperand = true; // Ready for new number or new operator (if chaining)
                updateDisplay();
                return;
            }
            if (target.classList.contains('digit')) { inputDigit(target.textContent); }
        });
    }

    if (openCalculatorFab) {
        openCalculatorFab.addEventListener('click', () => {
            calculatorOverlay.classList.add('active');
            resetCalculator(); updateDisplay();
        });
    }
    if (closeCalculatorButton) closeCalculatorButton.addEventListener('click', () => calculatorOverlay.classList.remove('active'));
    if (calculatorOverlay) calculatorOverlay.addEventListener('click', (event) => { if (event.target === calculatorOverlay) calculatorOverlay.classList.remove('active'); });

    // --- Common Logic & Event Listeners ---
    const addTransactionFab = document.getElementById('addTransactionFab');
    if (addTransactionFab) addTransactionFab.addEventListener('click', () => window.open(GOOGLE_FORM_URL, '_blank'));

    // Initialize page-specific functions
    if (document.getElementById('dashboard-page')) {
        updateDashboard();
    } else if (document.getElementById('transactions-page')) {
        const filterButton = document.getElementById('filterButton');
        const filterOptionsContainer = document.getElementById('filterOptionsContainer');
        const categoryFilterDropdown = document.getElementById('categoryFilterDropdown');
        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        const applyFiltersButton = document.getElementById('applyFiltersButton');
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        const monthButtons = document.querySelectorAll('.months-nav .month-button');

        if (filterButton) filterButton.addEventListener('click', () => filterOptionsContainer.style.display = filterOptionsContainer.style.display === 'flex' ? 'none' : 'flex');
        
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page
                const selectedCategory = categoryFilterDropdown.value;
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;
                monthButtons.forEach(btn => btn.classList.remove('active')); // Clear active month if date range used
                renderTransactions(null, selectedCategory, startDate, endDate); // Pass null for month if date range
                filterOptionsContainer.style.display = 'none';
            });
        }
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                currentTransactionsPage = 1; // Reset page
                categoryFilterDropdown.value = ''; startDateInput.value = ''; endDateInput.value = '';
                const today = new Date(); const currentMonth = today.getMonth() + 1;
                monthButtons.forEach(btn => btn.classList.remove('active'));
                const currentMonthBtn = document.querySelector(`.months-nav .month-button[data-month="${currentMonth}"]`);
                if (currentMonthBtn) currentMonthBtn.classList.add('active');
                renderTransactions(currentMonth);
                filterOptionsContainer.style.display = 'none';
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
                if(filterOptionsContainer) filterOptionsContainer.style.display = 'none';
            });
        });
        fetchAndProcessTransactions(); // Initial fetch and render
    } else if (document.getElementById('savings-page')) {
        updateSavingsPage();
    }
});
