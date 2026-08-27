const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxkAp7w3dIWrevXJexgk9MzzFpRZeCLc7RieIqFIMFf6QebyAbs5P1NhPSIXeA4Ggoa/exec';

const daysOfWeek = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
let prayerData = {};
daysOfWeek.forEach(day => { prayerData[day] = { isDone: false, items: [] }; });

// THEME HANDLING
const themeBtn = document.getElementById('themeToggle');
if (localStorage.getItem('prayerTheme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeBtn.textContent = '☀️ Den';
}

function toggleTheme() {
    const root = document.documentElement;
    if (root.getAttribute('data-theme') === 'dark') {
        root.removeAttribute('data-theme');
        localStorage.setItem('prayerTheme', 'light');
        themeBtn.textContent = '🌙 Noc';
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('prayerTheme', 'dark');
        themeBtn.textContent = '☀️ Den';
    }
}

let currentActiveItem = null;

// RENDER APP
function renderApp() {
    const appContainer = document.getElementById('app');
    const openDays = Array.from(document.querySelectorAll('.day-section.active')).map(el => el.dataset.day);
    appContainer.innerHTML = '';

    daysOfWeek.forEach(day => {
        const dayObj = prayerData[day];
        const section = document.createElement('div');
        section.className = `day-section ${openDays.includes(day) ? 'active' : ''}`;
        section.dataset.day = day;

        let itemsHtml = dayObj.items.map(item => `
            <li class="item">
                <div class="item-name" onclick="openModal('${day}', '${item.id}')">
                    ${item.name} ${item.notes ? '📝' : ''}
                </div>
                <div class="item-actions">
                    <button class="icon-btn" onclick="deleteItem('${day}', '${item.id}')">🗑️</button>
                </div>
            </li>
        `).join('');

        const isChecked = dayObj.isDone ? 'checked' : '';

        section.innerHTML = `
            <div class="day-header" onclick="toggleDay(this)">
                <div class="header-left">
                    <label class="custom-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" onchange="toggleDayDone('${day}', this.checked)" ${isChecked}>
                        <span class="checkmark"></span>
                    </label>
                    <span>${day}</span>
                </div>
                <span class="toggle-arrow">▼</span>
            </div>
            <div class="day-content">
                <ul class="item-list">
                    ${itemsHtml}
                </ul>
                <div class="add-form">
                    <input type="text" class="add-input" id="input-${day}" placeholder="Přidat jméno...">
                    <button class="btn" onclick="addItem('${day}')">+</button>
                </div>
            </div>
        `;
        appContainer.appendChild(section);
    });
}

function toggleDay(headerElement) { headerElement.parentElement.classList.toggle('active'); }

function toggleDayDone(day, isDone) {
    prayerData[day].isDone = isDone;
    saveDataToSheets();
}

function addItem(day) {
    const input = document.getElementById(`input-${day}`);
    const name = input.value.trim();
    if (name) {
        prayerData[day].items.push({ id: Date.now().toString(), name: name, notes: '' });
        renderApp();
        saveDataToSheets();
    }
}

function deleteItem(day, id) {
    if (confirm('Opravdu chceš smazat tuto položku?')) {
        prayerData[day].items = prayerData[day].items.filter(i => i.id !== id);
        renderApp();
        saveDataToSheets();
    }
}

// MODAL LOGIC
const modal = document.getElementById('noteModal');
const modalNotes = document.getElementById('modal-notes');

function openModal(day, id) {
    const item = prayerData[day].items.find(i => i.id === id);
    if (item) {
        currentActiveItem = { day, id };
        document.getElementById('modal-title').textContent = item.name;
        modalNotes.value = item.notes || '';
        modal.style.display = 'flex';
    }
}

function closeModal() { modal.style.display = 'none'; currentActiveItem = null; }

function saveNotes() {
    if (currentActiveItem) {
        const { day, id } = currentActiveItem;
        const itemIndex = prayerData[day].items.findIndex(i => i.id === id);
        if (itemIndex !== -1) {
            prayerData[day].items[itemIndex].notes = modalNotes.value;
            renderApp();
            closeModal();
            saveDataToSheets();
        }
    }
}

// MONDAY RESET
function checkAndResetMonday(data) {
    const today = new Date();
    if (today.getDay() === 1) {
        const dateString = today.toISOString().split('T')[0];
        const lastReset = localStorage.getItem('prayerAppLastReset');

        if (lastReset !== dateString) {
            let wasChanged = false;
            for (let dayKey in data) {
                if (data[dayKey].isDone) {
                    data[dayKey].isDone = false;
                    wasChanged = true;
                }
            }
            localStorage.setItem('prayerAppLastReset', dateString);
            return wasChanged;
        }
    }
    return false;
}

// DATA LOADING & SAVING (Bleskové načítání)
let userPin = localStorage.getItem('prayerAppPin');
if (!userPin) {
    userPin = prompt("Zadej přístupový PIN pro načtení seznamu:");
    if (userPin) localStorage.setItem('prayerAppPin', userPin);
}

function loadDataFromSheets() {
    // 1. Okamžité vykreslení z Cache (0ms)
    const cached = localStorage.getItem('prayerAppCache');
    if (cached) {
        prayerData = JSON.parse(cached);
        if (checkAndResetMonday(prayerData)) {
            localStorage.setItem('prayerAppCache', JSON.stringify(prayerData)); 
        }
        renderApp();
    } else {
        document.getElementById('loader').style.display = 'block'; // Ukáže "Připojování..." jen při úplně prvním načtení
    }

    // 2. Skryté načtení novinek z Googlu na pozadí
    fetch(WEB_APP_URL + '?pin=' + encodeURIComponent(userPin))
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert("Špatný PIN kód! Přístup odepřen.");
                localStorage.removeItem('prayerAppPin');
                location.reload();
                return;
            }
            
            // 3. Kontrola změn a neviditelné překreslení, pokud do toho na jiném zařízení někdo sáhnul
            const freshString = JSON.stringify(data);
            if (data && Object.keys(data).length > 0 && cached !== freshString) {
                prayerData = data;
                if (checkAndResetMonday(prayerData)) {
                    saveDataToSheets(); // Aktualizuje Google po pondělním resetu
                } else {
                    localStorage.setItem('prayerAppCache', JSON.stringify(prayerData));
                }
                renderApp();
            }
            document.getElementById('loader').style.display = 'none';
        })
        .catch(error => {
            console.error("Chyba spojení s Googlem. Používám lokální data.", error);
            document.getElementById('loader').style.display = 'none';
        });
}

function saveDataToSheets() {
    // Okamžitý lokální update na obrazovce a do paměti telefonu
    localStorage.setItem('prayerAppCache', JSON.stringify(prayerData));
    
    // Zbrklé odeslání do Googlu (Tiše na pozadí, uživatele to neblokuje v další práci)
    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ pin: userPin, data: prayerData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).catch(error => {
        console.error("Nepodařilo se odeslat do Googlu. Data jsou aspoň uložena lokálně.", error);
    });
}

// Spuštění
loadDataFromSheets();