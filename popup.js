// Глобальные переменные
let currentDate = new Date();
let bearerToken = null;
let employeeId = null;
let departmentId = null;
let currentSchedule = null;
let allEmployees = [];
let employeesList = [];
let showChangesOnly = false;
let lastUpdateTime = null;

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  await loadStoredData();
  setupEventListeners();
  await initialize();
});

// Загрузка сохраненных данных
async function loadStoredData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'bearerToken',
      'employeeId', 
      'departmentId',
      'departmentsList',
      'employeesList',
      'snapshots',
      'selectedEmployeeId',
      'lastUpdateTime'
    ], (result) => {
      bearerToken = result.bearerToken;
      departmentId = result.departmentId;
      employeesList = result.employeesList || [];
      employeeId = result.selectedEmployeeId || result.employeeId;
      lastUpdateTime = result.lastUpdateTime;
      
      console.log('Загружены данные:', { 
        bearerToken: !!bearerToken, 
        employeeId, 
        departmentId, 
        employeesCount: employeesList.length 
      });
      resolve();
    });
  });
}

// Настройка обработчиков событий
function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
  document.getElementById('changesBtn').addEventListener('click', toggleChanges);
  document.getElementById('exportBtn').addEventListener('click', exportToICal);
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
  document.getElementById('employeeDropdown').addEventListener('change', (e) => {
    employeeId = e.target.value;
    chrome.storage.local.set({ selectedEmployeeId: employeeId });
    loadSchedule();
  });
}

// Инициализация приложения
async function initialize() {
  if (!bearerToken) {
    showError('Токен не найден. Откройте banda.tseh85.ru и перейдите в раздел табеля.');
    return;
  }

  if (!departmentId) {
    showError('Department ID не найден. Откройте banda.tseh85.ru/table и обновите страницу.');
    return;
  }

  await loadEmployeeNames();
  
  if (!employeeId) {
    showError('Выберите сотрудника из списка');
    return;
  }

  await loadSchedule();
}

// Загрузка списка сотрудников
async function loadEmployeeNames() {
  try {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const url = `https://api.banda.tseh85.ru/api/banda/table/show?departmentId=${departmentId}&startedAt=${startStr}&endedAt=${endStr}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    
    if (!response.ok) {
      console.error('Ошибка загрузки табеля, статус:', response.status);
      throw new Error(`Ошибка загрузки табеля: ${response.status}`);
    }
    
    const data = await response.json();
    allEmployees = data.data?.items || [];

    // Показываем выпадающий список
    const select = document.getElementById('employeeDropdown');
    select.innerHTML = '<option value="">Выберите сотрудника...</option>';
    
    allEmployees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.user_id;
      const position = emp.position_sl_name?.split(' / ')[0] || 'Сотрудник';
      option.textContent = `${emp.name} — ${position}`;
      if (emp.user_id === employeeId) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    document.getElementById('employeeSelect').style.display = 'block';
    
  } catch (error) {
    console.error('Ошибка загрузки сотрудников:', error);
    // Пробуем офлайн режим
    if (allEmployees.length === 0) {
      showError('Не удалось загрузить список сотрудников. Проверьте подключение.');
    }
  }
}

// Загрузка расписания
async function loadSchedule() {
  showLoading();
  
  try {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Загрузка общего табеля
    const allScheduleUrl = `https://api.banda.tseh85.ru/api/banda/table/show?departmentId=${departmentId}&startedAt=${startStr}&endedAt=${endStr}`;
    
    const allResponse = await fetch(allScheduleUrl, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    
    if (!allResponse.ok) {
      throw new Error(`Ошибка загрузки общего табеля: ${allResponse.status}`);
    }
    
    const allData = await allResponse.json();
    allEmployees = allData.data?.items || [];

    // Загрузка личного табеля
    const personalUrl = `https://api.banda.tseh85.ru/api/banda/table/personal/show?employeeId=${employeeId}&startedAt=${startStr}&endedAt=${endStr}`;
    
    const personalResponse = await fetch(personalUrl, {
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });
    
    if (!personalResponse.ok) {
      throw new Error(`Ошибка загрузки личного табеля: ${personalResponse.status}`);
    }
    
    const personalData = await personalResponse.json();
    
    if (personalData.success && personalData.data?.items?.length > 0) {
      const newSchedule = personalData.data.items[0];
      
      // Сохраняем snapshot для отслеживания изменений
      await saveSnapshot(employeeId, monthKey, newSchedule);
      
      currentSchedule = newSchedule;
      document.getElementById('username').textContent = currentSchedule.name;
      
      // Обновляем время последнего обновления
      lastUpdateTime = new Date();
      chrome.storage.local.set({ 
        currentSchedule,
        lastUpdateTime: lastUpdateTime.toISOString()
      });
      
      updateLastUpdateIndicator();
      renderSchedule();
    } else {
      showError('Данные расписания не найдены');
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    showError('Ошибка загрузки: ' + error.message);
    
    // Офлайн режим
    chrome.storage.local.get(['currentSchedule'], (result) => {
      if (result.currentSchedule) {
        currentSchedule = result.currentSchedule;
        document.getElementById('username').textContent = currentSchedule.name;
        renderSchedule();
        showError('⚠️ Показаны сохраненные данные (офлайн)');
      }
    });
  }
}

// Сохранение snapshot для отслеживания изменений
async function saveSnapshot(empId, monthKey, schedule) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['snapshots'], (result) => {
      const snapshots = result.snapshots || {};
      
      if (!snapshots[empId]) {
        snapshots[empId] = {};
      }
      
      // Сохраняем предыдущий snapshot как "previous"
      if (snapshots[empId][monthKey]) {
        snapshots[empId][monthKey + '_previous'] = snapshots[empId][monthKey];
      }
      
      // Сохраняем текущий
      snapshots[empId][monthKey] = {
        time_slots: schedule.time_slots,
        total_time: schedule.total_time,
        timestamp: new Date().toISOString()
      };
      
      chrome.storage.local.set({ snapshots }, () => {
        console.log('✅ Snapshot сохранён для', empId, monthKey);
        resolve();
      });
    });
  });
}

// Получение изменений для даты
function detectChanges(dateStr, currentShift) {
  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['snapshots'], (result) => {
      const snapshots = result.snapshots || {};
      const previousSnapshot = snapshots[employeeId]?.[monthKey + '_previous'];
      
      if (!previousSnapshot || !previousSnapshot.time_slots) {
        resolve({ status: 'unchanged' });
        return;
      }

      const prevShift = previousSnapshot.time_slots[dateStr];
      
      if (!prevShift) {
        resolve({ status: 'new' });
        return;
      }

      const currRange = currentShift.ranges?.[0];
      const prevRange = prevShift.ranges?.[0];

      if (!currRange && prevRange) {
        resolve({ status: 'deleted', oldRange: prevRange });
        return;
      }

      if (currRange && prevRange) {
        if (currRange.started_at !== prevRange.started_at || 
            currRange.ended_at !== prevRange.ended_at ||
            currRange.description !== prevRange.description) {
          resolve({ status: 'changed', oldRange: prevRange });
          return;
        }
      }

      resolve({ status: 'unchanged' });
    });
  });
}

// Обновление данных
async function refreshData() {
  const now = Date.now();
  const lastUpdate = lastUpdateTime ? new Date(lastUpdateTime).getTime() : 0;
  
  // Debounce: не чаще раза в 30 секунд
  if (now - lastUpdate < 30000) {
    showError('⏱️ Подождите 30 секунд перед следующим обновлением');
    setTimeout(() => renderSchedule(), 2000);
    return;
  }
  
  await loadSchedule();
}

function toggleChanges() {
  showChangesOnly = !showChangesOnly;
  const btn = document.getElementById('changesBtn');
  btn.textContent = showChangesOnly ? '📋 Все смены' : '📊 Изменения';
  renderSchedule();
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  document.getElementById('currentMonth').textContent = formatMonth(currentDate);
  loadSchedule();
}

// Расчёт пересечения смен
function calculateOverlap(myStart, myEnd, colleagueStart, colleagueEnd) {
  const overlapStart = new Date(Math.max(new Date(myStart), new Date(colleagueStart)));
  const overlapEnd = new Date(Math.min(new Date(myEnd), new Date(colleagueEnd)));
  
  if (overlapStart < overlapEnd) {
    const hours = (overlapEnd - overlapStart) / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10; // Округляем до 1 знака
  }
  
  return 0;
}

// Отрисовка расписания
async function renderSchedule() {
  if (!currentSchedule || !currentSchedule.time_slots) {
    showError('Нет данных для отображения');
    return;
  }

  const content = document.getElementById('content');
  const shifts = Object.entries(currentSchedule.time_slots);
  
  if (shifts.length === 0) {
    content.innerHTML = '<div class="empty">📅 Нет смен в этом месяце</div>';
    return;
  }

  const workShifts = shifts.filter(([date, shift]) => shift.slug === 'worked');
  workShifts.sort((a, b) => new Date(a[0]) - new Date(b[0]));

  let totalHours = 0;
  let html = '';
  let changesCount = 0;

  for (const [dateStr, shift] of workShifts) {
    const changes = await detectChanges(dateStr, shift);
    
    if (changes.status !== 'unchanged') {
      changesCount++;
    }
    
    if (showChangesOnly && changes.status === 'unchanged') continue;

    const colleagues = getColleaguesForDate(dateStr, shift);
    
    totalHours += shift.hours || 0;

    const cardClass = changes.status === 'new' ? 'new' : 
                     changes.status === 'changed' ? 'changed' : 
                     changes.status === 'deleted' ? 'deleted' : '';

    const badge = changes.status === 'new' ? '<span class="shift-badge new">НОВАЯ</span>' :
                 changes.status === 'changed' ? '<span class="shift-badge changed">ИЗМЕНЕНО</span>' : '';

    const range = shift.ranges?.[0];
    const startTime = range ? formatTime(range.started_at) : '—';
    const endTime = range ? formatTime(range.ended_at) : '—';
    const description = range?.description ? `<div class="shift-description">⚠️ ${range.description}</div>` : '';
    
    const oldTime = changes.oldRange ? 
      `<div class="shift-old">Было: ${formatTime(changes.oldRange.started_at)} — ${formatTime(changes.oldRange.ended_at)}</div>` : '';

    const colleaguesHtml = colleagues.length > 0 ? `
      <div class="colleagues">
        <div class="colleagues-title">👥 Работают в смене:</div>
        ${colleagues.map(c => `
          <div class="colleague-item">${c.name} — ${c.time}${c.overlap > 0 ? ` (пересечение ${c.overlap} ч)` : ' (без пересечения)'}</div>
        `).join('')}
      </div>
    ` : '';

    html += `
      <div class="shift-card ${cardClass}">
        <div class="shift-header">
          <div class="shift-date">${formatDateRu(dateStr)}</div>
          ${badge}
        </div>
        <div class="shift-time">⏰ ${startTime} — ${endTime} (${shift.hours} ч)</div>
        ${description}
        ${oldTime}
        ${colleaguesHtml}
      </div>
    `;
  }

  if (html === '' && showChangesOnly) {
    html = '<div class="empty">✅ Нет изменений в расписании</div>';
  }

  content.innerHTML = html || '<div class="empty">📅 Нет рабочих смен</div>';
  
  // Обновляем футер с правильным подсчётом часов для текущего месяца
  const footer = `Всего часов: ${totalHours} ч.${changesCount > 0 ? ` | Изменений: ${changesCount}` : ''}`;
  document.getElementById('footer').textContent = footer;
}

function getColleaguesForDate(dateStr, myShift) {
  const colleagues = [];
  const myRange = myShift.ranges?.[0];
  
  if (!myRange) return colleagues;
  
  for (const emp of allEmployees) {
    if (emp.user_id === employeeId) continue;
    
    const empShift = emp.time_slots?.[dateStr];
    if (empShift && empShift.slug === 'worked' && empShift.ranges?.[0]) {
      const range = empShift.ranges[0];
      const name = emp.name.split(' ').slice(0, 2).join(' ');
      
      const overlap = calculateOverlap(
        myRange.started_at,
        myRange.ended_at,
        range.started_at,
        range.ended_at
      );
      
      colleagues.push({
        name: name,
        time: `${formatTime(range.started_at)}–${formatTime(range.ended_at)}`,
        hours: empShift.hours,
        overlap: overlap,
        startTime: range.started_at
      });
    }
  }

  colleagues.sort((a, b) => b.overlap - a.overlap || a.startTime.localeCompare(b.startTime));
  return colleagues;
}

function exportToICal() {
  if (!currentSchedule || !currentSchedule.time_slots) {
    alert('Нет данных для экспорта');
    return;
  }

  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Banda Schedule Helper//RU
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Banda Работа
X-WR-TIMEZONE:Europe/Moscow
`;

  for (const [dateStr, shift] of Object.entries(currentSchedule.time_slots)) {
    if (shift.slug !== 'worked' || !shift.ranges?.[0]) continue;
    
    const range = shift.ranges[0];
    const startDt = formatICalDateTime(range.started_at);
    const endDt = formatICalDateTime(range.ended_at);
    
    // Извлекаем адрес из position_sl_name
    const positionParts = currentSchedule.position_sl_name.split(' / ');
    const location = positionParts.length > 1 ? positionParts[1].replace('ФС ', '') : 'ЦЕХ85';
    
    // Summary: ЦЕХ85 // Адрес (часы)
    const summary = `ЦЕХ85 // ${location} (${shift.hours} ч)`;
    
    // Description с коллегами
    const colleagues = getColleaguesForDate(dateStr, shift);
    let description = '';
    
    if (range.description) {
      description += `Комментарий: ${range.description}\\n\\n`;
    }
    
    description += `Смена: ${formatTime(range.started_at)}–${formatTime(range.ended_at)}`;
    
    if (colleagues.length > 0) {
      description += `\\n\\nРаботают в смене:\\n`;
      colleagues.forEach(c => {
        description += `• ${c.name} — ${c.time}`;
        if (c.overlap > 0) {
          description += ` (пересечение ${c.overlap} ч)`;
        }
        description += `\\n`;
      });
    }
    
    ical += `BEGIN:VEVENT
UID:${dateStr}-${currentSchedule.user_id}@banda.tseh85.ru
DTSTAMP:${formatICalDateTime(new Date())}
DTSTART:${startDt}
DTEND:${endDt}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
STATUS:CONFIRMED
END:VEVENT
`;
  }

  ical += 'END:VCALENDAR';

  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `banda_schedule_${formatDate(currentDate)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function updateLastUpdateIndicator() {
  if (lastUpdateTime) {
    const time = new Date(lastUpdateTime);
    const formatted = `${time.getDate().toString().padStart(2, '0')}.${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getFullYear()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    document.getElementById('username').textContent = `${currentSchedule?.name || ''} | ⟳ ${formatted}`;
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonth(date) {
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateRu(dateStr) {
  const date = new Date(dateStr);
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
                  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '—';
  const parts = dateTimeStr.split(' ');
  if (parts.length < 2) return '—';
  return parts[1].substring(0, 5);
}

function formatICalDateTime(dateTime) {
  const d = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function showLoading() {
  document.getElementById('content').innerHTML = '<div class="loading">⏳ Загрузка расписания...</div>';
}

function showError(message) {
  document.getElementById('content').innerHTML = `<div class="error">❌ ${message}</div>`;
}