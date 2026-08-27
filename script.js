function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('budgetTheme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeBtn) themeBtn.textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeBtn) themeBtn.textContent = '🌙';
    }
}

function toggleTheme() {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    
    if (root.getAttribute('data-theme') === 'dark') {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('budgetTheme', 'light');
        themeBtn.textContent = '🌙';
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('budgetTheme', 'dark');
        themeBtn.textContent = '☀️';
    }
}

initTheme();

function getDateString(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let budgetData = JSON.parse(localStorage.getItem('myBudgetApp_v3'));

if (!budgetData) {
    const oldDataV1 = JSON.parse(localStorage.getItem('myBudgetApp')); 
    if (oldDataV1 && oldDataV1.income > 0) {
        const totalExpenses = oldDataV1.expenses.reduce((sum, item) => sum + item.amount, 0);
        const remaining = oldDataV1.income - totalExpenses;
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        budgetData = {
            monthId: oldDataV1.monthId,
            income: oldDataV1.income,
            wallet: 0, 
            monthPool: remaining > 0 ? remaining : 0, 
            totalSavings: oldDataV1.totalSavings || 0,
            lastProcessedDate: getDateString(yesterday), 
            expenses: oldDataV1.expenses
        };
        localStorage.setItem('myBudgetApp_v3', JSON.stringify(budgetData));
    } else {
        budgetData = { monthId: '', income: 0, wallet: 0, monthPool: 0, totalSavings: 0, lastProcessedDate: '', expenses: [] };
    }
}

function initApp() {
    const today = new Date();
    const currentMonthId = `${today.getFullYear()}-${today.getMonth() + 1}`;
    const todayStr = getDateString(today);

    if (budgetData.monthId !== currentMonthId) {
        if (budgetData.monthId !== '') budgetData.totalSavings += (budgetData.wallet + budgetData.monthPool);
        budgetData.monthId = currentMonthId; budgetData.income = 0; budgetData.wallet = 0; budgetData.monthPool = 0; budgetData.expenses = [];
        let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        budgetData.lastProcessedDate = getDateString(yesterday);
        saveData();
    }

    if (budgetData.income === 0) {
        document.getElementById('incomeModal').style.display = 'flex';
        document.getElementById('incomeInput').focus();
        return;
    } 

    if (budgetData.lastProcessedDate !== todayStr && budgetData.lastProcessedDate !== '') {
        if (budgetData.wallet > 0) {
            document.getElementById('leftoverAmountDisplay').innerText = formatMoney(Math.floor(budgetData.wallet)) + ' Kč';
            document.getElementById('dailyActionModal').style.display = 'flex';
            return; 
        } else {
            processDailyAllowance();
        }
    }
    updateUI();
}

function handleLeftover(action) {
    let leftover = budgetData.wallet;
    if (action === 'rozpocitat') budgetData.monthPool += leftover;
    else if (action === 'usporit') budgetData.totalSavings += leftover;
    budgetData.wallet = 0;
    document.getElementById('dailyActionModal').style.display = 'none';
    processDailyAllowance();
}

function processDailyAllowance() {
    if (!budgetData.lastProcessedDate) return;
    let parts = budgetData.lastProcessedDate.split('-');
    let lastDate = new Date(parts[0], parts[1]-1, parts[2]);
    let today = new Date(); today.setHours(0,0,0,0); lastDate.setHours(0,0,0,0);
    let changed = false;
    
    while(lastDate < today) {
        lastDate.setDate(lastDate.getDate() + 1);
        let daysInMonth = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0).getDate();
        let daysLeft = daysInMonth - lastDate.getDate() + 1; 
        if (daysLeft > 0 && budgetData.monthPool > 0) {
            let allowance = budgetData.monthPool / daysLeft;
            budgetData.wallet += allowance; budgetData.monthPool -= allowance;
        }
        budgetData.lastProcessedDate = getDateString(lastDate);
        changed = true;
    }
    if (changed) saveData();
    updateUI();
}

function saveData() { localStorage.setItem('myBudgetApp_v3', JSON.stringify(budgetData)); }

function updateUI() {
    document.getElementById('totalSavingsDisplay').innerText = formatMoney(Math.floor(budgetData.totalSavings));
    const limitDisplay = document.getElementById('dailyLimitDisplay');
    const walletVal = Math.floor(budgetData.wallet);
    limitDisplay.innerText = formatMoney(walletVal) + ' Kč';
    limitDisplay.style.color = walletVal < 0 ? 'var(--danger)' : 'var(--primary)';

    const remainingTotal = budgetData.wallet + budgetData.monthPool;
    document.getElementById('remainingMonthDisplay').innerText = formatMoney(Math.floor(remainingTotal)) + ' Kč';

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - today.getDate() + 1;
    document.getElementById('daysLeftDisplay').innerText = daysLeft;
    
    let nextDaysAvg = daysLeft > 0 ? remainingTotal / daysLeft : 0;
    document.getElementById('nextDaysDisplay').innerText = '(cca ' + formatMoney(Math.floor(nextDaysAvg)) + ' Kč / den)';

    renderExpenseList();
}

function renderExpenseList() {
    const listEl = document.getElementById('expenseList');
    listEl.innerHTML = '';
    if (budgetData.expenses.length === 0) {
        listEl.innerHTML = '<li style="text-align:center; color: var(--text-muted); padding: 10px 0;">Zatím žádné výdaje.</li>'; return;
    }
    const sorted = [...budgetData.expenses].sort((a, b) => b.id - a.id);
    sorted.forEach(item => {
        const li = document.createElement('li');
        li.className = 'expense-item';
        const dateObj = new Date(item.date);
        li.innerHTML = `
            <div class="expense-info"><strong>${item.desc}</strong><small>${dateObj.getDate()}.${dateObj.getMonth() + 1}.</small></div>
            <div class="expense-amount">-${formatMoney(item.amount)} Kč<button class="delete-btn" onclick="deleteExpense(${item.id})">&times;</button></div>
        `;
        listEl.appendChild(li);
    });
}

function formatMoney(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

function saveIncome() {
    const val = parseFloat(document.getElementById('incomeInput').value);
    if (val > 0) {
        budgetData.income = val;
        const today = new Date();
        const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
        const allowance = val / daysLeft;
        budgetData.wallet = allowance; budgetData.monthPool = val - allowance;
        budgetData.lastProcessedDate = getDateString(today);
        document.getElementById('incomeModal').style.display = 'none';
        saveData(); updateUI();
    }
}

function addQuickExpense(description, manualAmount = null, manualDate = null) {
    const amountInput = document.getElementById('quickAmount');
    const amount = manualAmount || parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
        amountInput.style.borderColor = 'var(--danger)'; setTimeout(() => amountInput.style.borderColor = 'var(--border-color)', 500); return;
    }
    budgetData.expenses.push({ id: Date.now(), desc: description, amount: amount, date: manualDate || new Date().toISOString() });
    budgetData.wallet -= amount;
    amountInput.value = '';
    saveData(); updateUI();
}

function deleteExpense(id) {
    if(confirm('Smazat tento výdaj? Peníze se ti vrátí do dnešního limitu.')) {
        const item = budgetData.expenses.find(i => i.id === id);
        if (item) { budgetData.wallet += item.amount; budgetData.expenses = budgetData.expenses.filter(i => i.id !== id); saveData(); updateUI(); }
    }
}

function openCustomModal(presetDesc = '') {
    const amount = document.getElementById('quickAmount').value;
    if(!amount) { alert("Nejdřív napiš částku nahoře!"); return; }
    document.getElementById('customDate').value = getDateString(new Date());
    document.getElementById('customDesc').value = presetDesc;
    document.getElementById('customModal').style.display = 'flex';
    presetDesc ? document.getElementById('customDate').focus() : document.getElementById('customDesc').focus();
}
function closeCustomModal() { document.getElementById('customModal').style.display = 'none'; }
function saveCustomExpense() {
    const amount = parseFloat(document.getElementById('quickAmount').value);
    const desc = document.getElementById('customDesc').value.trim() || 'Různé';
    addQuickExpense(desc, amount, document.getElementById('customDate').value || new Date().toISOString());
    closeCustomModal();
}

function openManageModal() {
    if (Math.floor(budgetData.wallet) <= 0) { alert("Dnes už v limitu nezbývají peníze ke správě."); return; }
    document.getElementById('manageInput').value = Math.floor(budgetData.wallet);
    document.getElementById('manageModal').style.display = 'flex';
}
function closeManageModal() { document.getElementById('manageModal').style.display = 'none'; }
function executeManage(actionType) {
    const val = parseFloat(document.getElementById('manageInput').value);
    if (!val || val <= 0 || val > budgetData.wallet) return alert("Zadej platnou částku do výše limitu.");
    if (actionType === 'rozpocitat') budgetData.monthPool += val;
    else if (actionType === 'usporit') budgetData.totalSavings += val;
    budgetData.wallet -= val;
    saveData(); updateUI(); closeManageModal();
}

function openSavingsModal() {
    document.getElementById('modalCurrentSavings').innerText = formatMoney(Math.floor(budgetData.totalSavings)) + ' Kč';
    document.getElementById('savingsManageInput').value = '';
    document.getElementById('savingsModal').style.display = 'flex';
}
function closeSavingsModal() { document.getElementById('savingsModal').style.display = 'none'; }

function addDirectToSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);
    const totalRemaining = budgetData.wallet + budgetData.monthPool;
    if (amount && amount > 0) {
        if (amount > totalRemaining) return alert('Tolik peněz ve svém aktuálním rozpočtu nemáš.');
        budgetData.totalSavings += amount;
        if (amount <= budgetData.monthPool) budgetData.monthPool -= amount;
        else { budgetData.wallet -= (amount - budgetData.monthPool); budgetData.monthPool = 0; }
        
        const today = new Date(); const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
        if (daysLeft > 0) { const rem = budgetData.wallet + budgetData.monthPool; budgetData.wallet = rem / daysLeft; budgetData.monthPool = rem - budgetData.wallet; budgetData.lastProcessedDate = getDateString(today); }
        saveData(); updateUI(); closeSavingsModal();
    }
}

function withdrawDirectFromSavings() {
    const amount = parseFloat(document.getElementById('savingsManageInput').value);
    if (amount && amount > 0) {
        if (amount > budgetData.totalSavings) return alert('Tolik peněz v úsporách nemáš.');
        budgetData.totalSavings -= amount; budgetData.monthPool += amount;
        
        const today = new Date(); const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
        if (daysLeft > 0) { const rem = budgetData.wallet + budgetData.monthPool; budgetData.wallet = rem / daysLeft; budgetData.monthPool = rem - budgetData.wallet; budgetData.lastProcessedDate = getDateString(today); }
        saveData(); updateUI(); closeSavingsModal();
    }
}

function openSettingsModal() { document.getElementById('editIncomeInput').value = budgetData.income; document.getElementById('settingsModal').style.display = 'flex'; }
function closeSettingsModal() { document.getElementById('settingsModal').style.display = 'none'; }
function saveEditedIncome() {
    const newIncome = parseFloat(document.getElementById('editIncomeInput').value);
    if (newIncome && newIncome > 0) {
        budgetData.monthPool += (newIncome - budgetData.income); budgetData.income = newIncome;
        saveData(); updateUI(); alert('Měsíční rozpočet byl úspěšně upraven.');
    }
}

function forceRecalculate() {
    const totalRemaining = budgetData.wallet + budgetData.monthPool;
    const today = new Date(); const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
    if (daysLeft > 0) {
        budgetData.wallet = totalRemaining / daysLeft; budgetData.monthPool = totalRemaining - budgetData.wallet; budgetData.lastProcessedDate = getDateString(today);
        saveData(); updateUI(); alert('Rozpočet byl srovnán.');
    }
    closeSettingsModal();
}

function hardResetApp() {
    if (prompt("⚠️ TOTO SMAŽE ÚPLNĚ VŠECHNA DATA!\nPokud opravdu chceš aplikaci vyresetovat, napiš:\nSMAZAT") === "SMAZAT") {
        localStorage.removeItem('myBudgetApp'); localStorage.removeItem('myBudgetApp_v2'); localStorage.removeItem('myBudgetApp_v3'); location.reload();
    } else { alert("Bezpečnostní pojistka smazání zrušila."); }
}

initApp();

// --- ZRYCHLENÉ NAČÍTÁNÍ Z GOOGLE TABULEK (STALE-WHILE-REVALIDATE) ---
/* 
 Použití: Místo klasického fetch() volej tuto funkci. 
 Příklad: fetchGoogleSheetsDataWithCache('Tvá_URL_K_API', 'sauna_data_cache', vykresliDataDoStranky);
*/
function fetchGoogleSheetsDataWithCache(apiUrl, cacheKey, callback) {
    // 1. Okamžité vykreslení (čas 0ms)
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try { callback(JSON.parse(cachedData)); } catch(e) { console.error("Chyba čtení mezipaměti", e); }
    }

    // 2. Skryté načtení novinek na pozadí
    fetch(apiUrl)
        .then(response => response.json())
        .then(freshData => {
            const freshString = JSON.stringify(freshData);
            // 3. Překreslit pouze pokud Google vrátil jiná data než máme
            if (cachedData !== freshString) {
                localStorage.setItem(cacheKey, freshString);
                callback(freshData);
            }
        })
        .catch(err => console.error("Tabulka momentálně nedostupná:", err));
}