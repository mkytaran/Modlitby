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

// RENDER APP (s kroužkem pro postupné označování)
function renderApp() {
    const appContainer = document.getElementById('app');
    const openDays = Array.from(document.querySelectorAll('.day-section.active')).map(el => el.dataset.day);
    appContainer.innerHTML = '';

    daysOfWeek.forEach(day => {
        const dayObj = prayerData[day];
        if (!dayObj) return;
        
        const section = document.createElement('div');
        section.className = `day-section ${openDays.includes(day) ? 'active' : ''}`;
        section.dataset.day = day;

        let itemsArray = dayObj.items || [];
        let totalItems = itemsArray.length;
        let doneItems = itemsArray.filter(i => i.isDone).length;
        let progress = 0;
        
        // Správný výpočet pro graf i pro dny bez položek
        if (totalItems > 0) {
            progress = (doneItems / totalItems) * 100;
            dayObj.isDone = (doneItems === totalItems);
        } else if (dayObj.isDone) {
            progress = 100;
        }

        let itemsHtml = itemsArray.map(item => `
            <li class="item">
                <div class="item-name ${item.isDone ? 'done-text' : ''}" onclick="openModal('${day}', '${item.id}')">
                    ${item.name} ${item.notes ? '📝' : ''}
                </div>
                <input type="checkbox" class="item-checkbox" onchange="toggleItemDone('${day}', '${item.id}', this.checked)" ${item.isDone ? 'checked' : ''}>
            </li>
        `).join('');

        const isChecked = dayObj.isDone ? 'checked' : '';

        section.innerHTML = `
            <div class="day-header" onclick="toggleDay(this)">
                <div class="header-left">
                    <label class="custom-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" onchange="toggleDayDone('${day}', this.checked)" ${isChecked}>
                        <span class="checkmark" style="--progress: ${progress}%"></span>
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
    if (prayerData[day].items) {
        prayerData[day].items.forEach(item => { item.isDone = isDone; });
    }
    renderApp();
    saveDataToSheets();
}

function toggleItemDone(day, id, isDone) {
    const item = prayerData[day].items.find(i => i.id === id);
    if (item) {
        item.isDone = isDone;
        renderApp();
        saveDataToSheets();
    }
}

function addItem(day) {
    const input = document.getElementById(`input-${day}`);
    const name = input.value.trim();
    if (name) {
        if (!prayerData[day].items) prayerData[day].items = [];
        prayerData[day].items.push({ id: Date.now().toString(), name: name, notes: '', isDone: false });
        renderApp();
        saveDataToSheets();
    }
}

function deleteCurrentItem() {
    if (currentActiveItem) {
        const { day, id } = currentActiveItem;
        const itemToDelete = prayerData[day].items.find(i => i.id === id);
        if (itemToDelete && confirm(`Opravdu chceš smazat položku "${itemToDelete.name}"?`)) {
            prayerData[day].items = prayerData[day].items.filter(i => i.id !== id);
            renderApp();
            closeModal();
            saveDataToSheets();
        }
    }
}

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

function checkAndResetMonday(data) {
    const today = new Date();
    if (today.getDay() === 1) { // 1 = Pondělí
        const dateString = today.toISOString().split('T')[0];
        const lastReset = localStorage.getItem('prayerAppLastReset');

        if (lastReset !== dateString) {
            let wasChanged = false;
            for (let dayKey in data) {
                if (dayKey === '_lastUpdate') continue; // Ignoruje případný balast
                
                if (data[dayKey] && data[dayKey].isDone) { data[dayKey].isDone = false; wasChanged = true; }
                if (data[dayKey] && data[dayKey].items) {
                    data[dayKey].items.forEach(item => {
                        if (item.isDone) { item.isDone = false; wasChanged = true; }
                    });
                }
            }
            localStorage.setItem('prayerAppLastReset', dateString);
            return wasChanged;
        }
    }
    return false;
}

// ----------------------------------------------------
// BLESKOVÉ NAČÍTÁNÍ A BEZPEČNÉ ODESÍLÁNÍ NA POZADÍ
// ----------------------------------------------------

let userPin = localStorage.getItem('prayerAppPin');
if (!userPin) {
    userPin = prompt("Zadej přístupový PIN pro načtení seznamu:");
    if (userPin) localStorage.setItem('prayerAppPin', userPin);
}

function loadDataFromSheets() {
    const cached = localStorage.getItem('prayerAppCache');
    const pendingSync = localStorage.getItem('prayerPendingSync');

    if (cached) {
        prayerData = JSON.parse(cached);
        
        // ZÁSADNÍ OPRAVA: Odstranění chybného razítka, které rozbíjelo Google Script
        if (prayerData._lastUpdate !== undefined) {
            delete prayerData._lastUpdate;
            localStorage.setItem('prayerAppCache', JSON.stringify(prayerData));
        }

        if (checkAndResetMonday(prayerData)) {
            localStorage.setItem('prayerAppCache', JSON.stringify(prayerData));
            localStorage.setItem('prayerPendingSync', 'true');
        }
        renderApp();
    } else {
        document.getElementById('loader').style.display = 'block';
    }

    // Pokud je vztyčená vlajka, že se minule nestihlo uložit, pošleme to tam hned
    if (pendingSync === 'true') {
        saveDataToSheets();
        document.getElementById('loader').style.display = 'none';
        return; 
    }

    fetch(WEB_APP_URL + '?pin=' + encodeURIComponent(userPin))
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert("Špatný PIN kód! Přístup odepřen.");
                localStorage.removeItem('prayerAppPin');
                location.reload();
                return;
            }
            
            const freshString = JSON.stringify(data);
            
            // Ochrana před přepsáním čerstvě naklikaných dat
            if (data && Object.keys(data).length > 0 && cached !== freshString && !localStorage.getItem('prayerPendingSync')) {
                prayerData = data;
                if (checkAndResetMonday(prayerData)) {
                    saveDataToSheets();
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
    localStorage.setItem('prayerAppCache', JSON.stringify(prayerData));
    localStorage.setItem('prayerPendingSync', 'true'); // Vztyčení ochranné vlajky
    
    // Tiché a velmi agresivní odeslání do Googlu (nezruší se ani při zavření okna)
    fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ pin: userPin, data: prayerData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        keepalive: true
    })
    .then(res => {
        if (res.ok) {
            localStorage.removeItem('prayerPendingSync'); // Data jsou u Googlu, vlajka dolů
        }
    })
    .catch(error => {
        console.error("Zápis selhal. Pokusí se znovu při dalším spuštění.", error);
    });
}

loadDataFromSheets();