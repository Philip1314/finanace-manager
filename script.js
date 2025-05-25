document.addEventListener('DOMContentLoaded', () => {
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQgMFbI8pivLbRpc2nL2Gyoxw47PmXEVxvUDrjr-t86gj4-J3QM8uV7m8iJN9wxlYo3IY5FQqqUICei/pub?output=csv';
    const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdrDJoOeo264aOn4g2UEe-K-FHpbssBAVmEtOWoW46Q1cwjgg/viewform?usp=header';

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
                case 'savings': icon = '🏦'; break; // New icon for savings
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

    // --- Dashboard Specific Logic (index.html) ---
    let allDashboardData = []; // Store all fetched data for dashboard filters

    async function updateDashboard(selectedCategory = '', startDate = null, endDate = null) {
        if (!document.getElementById('dashboard-page')) return;

        try {
            if (allDashboardData.length === 0) { // Fetch only if not already fetched
                const response = await fetch(CSV_URL);
                const csv = await response.text();
                allDashboardData = parseCSV(csv);
                populateMainCategoryFilter(); // Populate filter dropdown after fetching
            }

            let filteredData = allDashboardData.filter(entry => {
                const amount = parseFloat(entry.Amount);
                const date = new Date(entry.Date);
                const entryType = entry.Type ? entry.Type.toLowerCase() : '';
                const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : '';

                if (isNaN(amount) || isNaN(date) || !entryType) {
                    console.warn('Dashboard - Skipping malformed entry:', entry);
                    return false;
                }

                const entryDate = new Date(entry.Date);
                entryDate.setHours(0, 0, 0, 0);

                // Category filtering
                if (selectedCategory) {
                    const lowerCaseSelectedCategory = selectedCategory.toLowerCase();
                    if (lowerCaseSelectedCategory === 'gains') {
                        if (entryType !== 'gains') return false;
                    } else if (lowerCaseSelectedCategory === 'expenses') {
                        if (entryType !== 'expenses') return false;
                    } else if (entryWhatKind !== lowerCaseSelectedCategory) {
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


            let totalExpensesAmount = 0;
            let totalGainsAmount = 0;
            let totalSavingsAmount = 0; // New variable for savings

            const expenseCategoriesForChart = { Food: 0, Medicines: 0, Shopping: 0, Misc: 0 };

            filteredData.forEach(entry => { // Use filteredData
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
                    if (entryWhatKind === 'savings') { // Identify savings entries
                        totalSavingsAmount += amount;
                    }
                }
            });

            const netExpenseForDisplay = totalExpensesAmount;
            document.getElementById('netExpenseValue').textContent = formatCurrency(netExpenseForDisplay);
            document.getElementById('totalSavingsAmount').textContent = formatCurrency(totalSavingsAmount); // Update savings amount

            const remainingBalance = totalGainsAmount - totalExpensesAmount;
            const totalIncomeOrBudget = totalGainsAmount;

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
                    progressColor = 'var(--accent-orange)';
                }
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
                            borderColor: 'var(--card-bg)', // Set border to white
                            borderWidth: 8, // Thicker border
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%', // Slightly adjust cutout for thickness
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

        } catch (error) {
            console.error('Error fetching or processing CSV for dashboard:', error);
            if (document.getElementById('netExpenseValue')) document.getElementById('netExpenseValue').textContent = '₱ Error';
            if (document.getElementById('remainingBalanceAmount')) document.getElementById('remainingBalanceAmount').textContent = '₱ Error';
            if (document.getElementById('totalSavingsAmount')) document.getElementById('totalSavingsAmount').textContent = '₱ Error';
        }
    }

    function populateMainCategoryFilter() {
        const mainCategoryFilterDropdown = document.getElementById('mainCategoryFilterDropdown');
        if (!mainCategoryFilterDropdown) return;

        mainCategoryFilterDropdown.innerHTML = '<option value="">All Categories</option>';

        const uniqueCategories = new Set();
        allDashboardData.forEach(entry => {
            if (entry['What kind?'] && entry.Type && entry.Type.toLowerCase() === 'expenses') {
                uniqueCategories.add(entry['What kind?'].trim());
            } else if (entry.Type && entry.Type.toLowerCase() === 'gains') {
                uniqueCategories.add(entry['What kind?'].trim()); // Add all 'What kind' for gains
            }
        });

        const sortedCategories = Array.from(uniqueCategories).sort();

        // Add specific "type" filters if needed
        const typeFilters = [];
        if (allDashboardData.some(entry => entry.Type && entry.Type.toLowerCase() === 'gains')) {
            typeFilters.push('Gains');
        }
        if (allDashboardData.some(entry => entry.Type && entry.Type.toLowerCase() === 'expenses')) {
            typeFilters.push('Expenses');
        }

        typeFilters.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            mainCategoryFilterDropdown.appendChild(option);
        });

        sortedCategories.forEach(category => {
            if (category && !['salary', 'allowance', 'savings'].includes(category.toLowerCase())) { // Avoid duplicates if already covered by "Gains"
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                mainCategoryFilterDropdown.appendChild(option);
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
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Salary') {
                uniqueCategories.add('Salary'); // Explicitly add Salary for gains
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Allowance') {
                uniqueCategories.add('Allowance'); // Explicitly add Allowance for gains
            }
            if (entry.Type && entry.Type.toLowerCase() === 'gains' && entry['What kind?'].trim() === 'Savings') {
                uniqueCategories.add('Savings'); // Explicitly add Savings
            }
        });

        // Sort categories alphabetically, add "Gains" to the top
        const sortedCategories = Array.from(uniqueCategories).sort();
        const finalCategories = ['Gains']; // Start with Gains
        sortedCategories.forEach(cat => {
            // Avoid adding "Salary" or "Allowance" separately if "Gains" handles them broadly
            // Or add specific ones like 'Food', 'Medicines', 'Shopping', etc.
            if (!['salary', 'allowance', 'gains', 'expenses', 'savings'].includes(cat.toLowerCase())) { // Exclude 'gains' and 'expenses' as they are type filters
                finalCategories.push(cat);
            }
        });

        // Add a specific 'Expenses' category if not already implicitly covered by 'Food', 'Medicines', etc.
        // This makes filtering more robust if 'Type' is needed explicitly.
        if (!finalCategories.includes('Expenses')) {
             finalCategories.splice(1, 0, 'Expenses'); // Add 'Expenses' after 'Gains'
        }


        // Re-populate options, keeping 'All Categories' at the top
        finalCategories.forEach(category => {
            if (category) { // Ensure no empty categories are added
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilterDropdown.appendChild(option);
            }
        });
    }


    function renderTransactions(selectedMonth, selectedCategory = '', startDate = null, endDate = null, isSavingsPage = false) {
        const transactionsListDiv = document.getElementById('transactionsList');
        if (!transactionsListDiv) return;

        let dataToFilter = isSavingsPage ? allDashboardData : allTransactionsData; // Use allDashboardData for savings page

        let filteredData = dataToFilter.filter(entry => {
            const amount = parseFloat(entry.Amount);
            const date = new Date(entry.Date);
            const entryType = entry.Type ? entry.Type.toLowerCase() : '';
            const entryWhatKind = entry['What kind?'] ? entry['What kind?'].toLowerCase() : ''; // Use 'What kind' here

            if (isNaN(amount) || isNaN(date) || !entryType) {
                console.warn('Skipping malformed entry:', entry);
                return false;
            }

            // If it's the savings page, only show 'savings' entries under 'gains'
            if (isSavingsPage) {
                if (!(entryType === 'gains' && entryWhatKind === 'savings')) {
                    return false;
                }
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
                const actualCa
