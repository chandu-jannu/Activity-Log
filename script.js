// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}


const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let notifToastTimer = null;
let pendingDeleteId = null;


const state = {
    tasks: [],
    currentDate: new Date(),
    currentCategory: 'daily',
    completionHistory: {},
    assignments: [],
    dailyCompletionStats: {},
    selectedDate: null,
    timer: {
        minutes: 10,
        seconds: 0,
        isRunning: false,
        interval: null,
        customDuration: 10
    }
};


const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function init() {
    initTheme();
    loadTasks();
    loadAssignments();
    setupEventListeners();
    updateDateDisplay();
    updateLiveTime();
    setInterval(updateLiveTime, 1000);
    checkForNewDay();
    Notification.requestPermission();
    setInterval(checkForNewDay, 60000);
    setInterval(checkTaskNotification, 1000);
    renderCategoryToggles();
    renderTasks();
    renderCalendar();
    renderWeeklySchedule();
    renderAssignments();
    renderHistory();
    updateAnalytics();
    updateStreak();
    renderDailyTip();
    
    setTimeout(fetchWeather, 100);
}

function checkForNewDay() {
    const now = new Date();
    const stored = localStorage.getItem('lastCheckDate');
    const today = now.toDateString();

    if (stored && stored !== today) {
        saveCompletionForYesterday();
        saveDailyCompletionPercentage();
        checkWeeklyTasksCompletion(now);
        updateDateDisplay();
        renderWeeklySchedule();
        renderCalendar();
        renderTasks();
    }

    localStorage.setItem('lastCheckDate', today);
}

function checkWeeklyTasksCompletion(now) {
    const dayOfWeek = now.getDay();
    
    if (dayOfWeek === 0) {
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 7);
        lastWeekStart.setHours(0, 0, 0, 0);
        
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);
        
        const lastWeekTasks = state.tasks.filter(t => {
            if (t.category !== 'weekly') return false;
            const taskDate = new Date(t.date);
            return taskDate >= lastWeekStart && taskDate <= lastWeekEnd;
        });
        
        const incompleteTasks = lastWeekTasks.filter(t => !t.completed);
        
        if (incompleteTasks.length > 0) {
            showNotifToast('warning', '⚠️', `${incompleteTasks.length} Weekly Task${incompleteTasks.length > 1 ? 's' : ''} Incomplete`, incompleteTasks.map(t => '• ' + t.text).join('\n'), 0);
        }
    }
}

function saveDailyCompletionPercentage() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toDateString();

    const tasksYesterday = state.tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate.toDateString() === dateKey && t.category === 'daily';
    });

    if (tasksYesterday.length > 0) {
        const completed = tasksYesterday.filter(t => t.completed).length;
        const percentage = Math.round((completed / tasksYesterday.length) * 100);
        
        state.dailyCompletionStats[dateKey] = {
            total: tasksYesterday.length,
            completed: completed,
            percentage: percentage
        };
        
        saveTasks();
    }
}

function saveCompletionForYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toDateString();

    const tasksYesterday = state.tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate.toDateString() === dateKey && t.category === 'daily';
    });

    if (tasksYesterday.length > 0) {
        if (!state.completionHistory[dateKey]) {
            state.completionHistory[dateKey] = {
                count: 0,
                totalTasks: 0,
                tasks: []
            };
        }
        
        state.completionHistory[dateKey] = {
            count: tasksYesterday.filter(t => t.completed).length,
            totalTasks: tasksYesterday.length,
            tasks: tasksYesterday.map(t => ({
                text: t.text,
                completed: t.completed,
                completedAt: t.completedAt,
                category: 'daily'
            }))
        };

        state.tasks = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            return !(taskDate.toDateString() === dateKey && t.category === 'daily');
        });

        saveTasks();
        renderTasks();
        renderHistory();
    }
}

function setupEventListeners() {
    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') addTask();
    });
    document.getElementById('prevMonth').addEventListener('click', prevMonth);
    document.getElementById('nextMonth').addEventListener('click', nextMonth);
    document.getElementById('startBtn').addEventListener('click', toggleTimer);
    document.getElementById('resetBtn').addEventListener('click', resetTimer);
    document.getElementById('editBtn').addEventListener('click', editTimer);
    document.getElementById('addAssignmentBtn').addEventListener('click', toggleAssignmentForm);
    document.getElementById('saveAssignmentBtn').addEventListener('click', saveAssignment);
    document.getElementById('cancelAssignmentBtn').addEventListener('click', toggleAssignmentForm);
    document.getElementById('resetAllBtn').addEventListener('click', resetAllData);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function resetAllData() {
    const modal = document.getElementById('resetModal');
    document.body.appendChild(modal);
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);';
}

function closeResetModal() {
    const modal = document.getElementById('resetModal');
    modal.style.display = 'none';
}

function executeResetAll() {
    localStorage.clear();
    state.tasks = [];
    state.completionHistory = {};
    state.assignments = [];
    state.dailyCompletionStats = {};
    SUPPLEMENTS = [...DEFAULT_SUPPLEMENTS];
    saveSupplements();
    renderTasks();
    renderCalendar();
    renderWeeklySchedule();
    renderAssignments();
    renderHistory();
    updateAnalytics();
    closeResetModal();
    showNotifToast('success', '✅', 'All Clear', 'All data has been reset successfully.', 3000);
}

function editTimer() {
    const minutes = prompt('Enter timer duration in minutes:', state.timer.customDuration);
    if (minutes === null) return;
    const parsed = parseInt(minutes);
    if (!parsed || parsed < 1) return;
    if (state.timer.isRunning) {
        clearInterval(state.timer.interval);
        state.timer.isRunning = false;
        document.getElementById('startBtn').textContent = 'Start';
    }
    state.timer.customDuration = parsed;
    state.timer.minutes = parsed;
    state.timer.seconds = 0;
    updateTimerDisplay();
}

function toggleTimer() {
    const btn = document.getElementById('startBtn');
    
    if (state.timer.isRunning) {
        clearInterval(state.timer.interval);
        state.timer.isRunning = false;
        btn.textContent = 'Start';
    } else {
        state.timer.isRunning = true;
        btn.textContent = 'Pause';
        
        state.timer.interval = setInterval(() => {
            if (state.timer.seconds === 0) {
                if (state.timer.minutes === 0) {
                    timerComplete();
                    return;
                }
                state.timer.minutes--;
                state.timer.seconds = 59;
            } else {
                state.timer.seconds--;
            }
            updateTimerDisplay();
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(state.timer.interval);
    state.timer.isRunning = false;
    document.getElementById('startBtn').textContent = 'Start';
    state.timer.minutes = state.timer.customDuration;
    state.timer.seconds = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const mins = String(state.timer.minutes).padStart(2, '0');
    const secs = String(state.timer.seconds).padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${mins}:${secs}`;
}

function timerComplete() {
    clearInterval(state.timer.interval);
    state.timer.isRunning = false;
    document.getElementById('startBtn').textContent = 'Start';
    showNotifToast('success', '🎉', 'Timer Complete!', `Your ${state.timer.customDuration} minute session is done!`, 5000);
     [0, 0.4, 0.8].forEach(delay => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 660;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.8);
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + 0.8);
    });
    resetTimer();
}

function renderCategoryToggles() {
    const container = document.getElementById('categoryToggle');
    ['daily', 'weekly', 'monthly'].forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `toggle-btn ${cat === state.currentCategory ? 'active' : ''}`;
        btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.addEventListener('click', () => filterTasks(cat));
        container.appendChild(btn);
    });
}

function updateDateDisplay() {
    const today = new Date();
    document.getElementById('monthBox').textContent = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('dayBox').textContent = String(today.getDate()).padStart(2, '0');
}

function updateLiveTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('liveTime').textContent = `${hours}:${minutes}:${seconds}`;
}
function fetchWeather() {
    const now = new Date();
    const hour = now.getHours();
    
    let temp, feelsLike, desc, wind;
    
    if (hour >= 20 || hour < 6) {
        temp = Math.floor(Math.random() * 11) + 55;
        feelsLike = temp - Math.floor(Math.random() * 3);
        desc = ['Clear Night', 'Cloudy Night', 'Calm Night'][Math.floor(Math.random() * 3)];
        wind = Math.floor(Math.random() * 4) + 2;
    }
    else if (hour >= 6 && hour < 11) {
        temp = Math.floor(Math.random() * 11) + 65;
        feelsLike = temp - Math.floor(Math.random() * 2);
        desc = ['Partly Cloudy', 'Light Breeze', 'Morning Fresh', 'Mostly Clear'][Math.floor(Math.random() * 4)];
        wind = Math.floor(Math.random() * 5) + 3;
    }
    else if (hour >= 11 && hour < 16) {
        temp = Math.floor(Math.random() * 16) + 80;
        feelsLike = temp + Math.floor(Math.random() * 5);
        desc = ['Clear Sky', 'Sunny', 'Bright Sun', 'Hot & Clear'][Math.floor(Math.random() * 4)];
        wind = Math.floor(Math.random() * 6) + 5;
    }
    else {
        temp = Math.floor(Math.random() * 11) + 70;
        feelsLike = temp - Math.floor(Math.random() * 2);
        desc = ['Cloudy', 'Overcast', 'Partly Cloudy', 'Cooling Down'][Math.floor(Math.random() * 4)];
        wind = Math.floor(Math.random() * 5) + 4;
    }
    
    document.getElementById('weatherLocation').textContent = 'Hyderabad';
    document.getElementById('weatherTemp').textContent = `${temp}°F`;
    document.getElementById('weatherDesc').textContent = desc;
    document.getElementById('weatherWind').textContent = `${wind} mph`;
    document.getElementById('weatherFeels').textContent = `${feelsLike}°F`;
    
    setTimeout(fetchWeather, 30 * 60 * 1000);
}

function addTask() {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
    
    if (state.selectedDate) {
    const selected = new Date(state.selectedDate);
    selected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selected < today) {
        showNotifToast('warning', '⚠️', 'Past Date!', "Can't add tasks to past dates.", 3000);
        return;
    }
}

    const taskDate = state.selectedDate ? new Date(state.selectedDate) : new Date();

    state.tasks.push({
        id: Date.now(),
        text,
        completed: false,
        date: taskDate.toISOString(),
        category: state.currentCategory,
        time: timeStr
    });

    saveTasks();
    
    if (state.selectedDate) {
        renderTasksForDate();
    } else {
        renderTasks();
    }
    
    renderWeeklySchedule();
    renderHistory();
    updateCalendarCompletion();
    updateAnalytics();
    input.value = '';
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveTasks();
        
    if (state.selectedDate) {
        renderTasksForDate();
    } else {
        renderTasks();
    }
    
    renderWeeklySchedule();
    updateCalendarCompletion();
    updateAnalytics();
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
        
    task.completed = !task.completed;

    if (task.completed) {
        const now = new Date();
        task.completedAt = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    } else {
        task.completedAt = null;
    }

    const today = new Date();
    const todayKey = today.toDateString();

    if (!state.completionHistory[todayKey]) {
        state.completionHistory[todayKey] = {
            count: 0,
            totalTasks: 0,
            tasks: []
        };
    }

    if (!state.completionHistory[todayKey].tasks) {
        state.completionHistory[todayKey].tasks = [];
    }

    if (task.completed) {
        const existingTask = state.completionHistory[todayKey].tasks.find(t => {
            const tText = typeof t === 'string' ? t : t.text;
            return tText === task.text;
        });
        
        if (!existingTask) {
            state.completionHistory[todayKey].tasks.push({
                text: task.text,
                completed: true,
                category: task.category,
                completedAt: task.completedAt
            });
            state.completionHistory[todayKey].count++;
        }
    } else {
        const taskIndex = state.completionHistory[todayKey].tasks.findIndex(t => {
            const tText = typeof t === 'string' ? t : t.text;
            return tText === task.text;
        });
        
        if (taskIndex !== -1) {
            state.completionHistory[todayKey].tasks.splice(taskIndex, 1);
            state.completionHistory[todayKey].count = Math.max(0, state.completionHistory[todayKey].count - 1);
        }
    }
    
    saveTasks();
    
    if (state.selectedDate) {
        renderTasksForDate();
    } else {
        renderTasks();
    }
    
    renderHistory();
    updateCalendarCompletion();
    updateAnalytics();
    updateStreak();
}

let isUpdatingCalendar = false;

function updateCalendarCompletion() {
    if (isUpdatingCalendar) return;
    isUpdatingCalendar = true;
    
    const uniqueDates = [...new Set(state.tasks.filter(t => t.category === 'daily').map(t => new Date(t.date).toDateString()))];
    
    uniqueDates.forEach(dateKey => {
        const tasksForDate = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            return taskDate.toDateString() === dateKey && t.category === 'daily';
        });

        if (tasksForDate.length > 0) {
            const completed = tasksForDate.filter(t => t.completed).length;
            const percentage = Math.round((completed / tasksForDate.length) * 100);
            
            state.dailyCompletionStats[dateKey] = {
                total: tasksForDate.length,
                completed: completed,
                percentage: percentage
            };
        } else {
            delete state.dailyCompletionStats[dateKey];
        }
    });
    
    Object.keys(state.dailyCompletionStats).forEach(dateKey => {
        const hasTasksForDate = state.tasks.some(t => new Date(t.date).toDateString() === dateKey && t.category === 'daily');
        if (!hasTasksForDate) {
            delete state.dailyCompletionStats[dateKey];
        }
    });
    
    saveTasks();
    
    requestAnimationFrame(() => {
        renderCalendar();
        isUpdatingCalendar = false;
    });
}

function filterTasks(cat) {
    state.currentCategory = cat;
    state.selectedDate = null;
    document.querySelectorAll('.toggle-btn').forEach((btn, i) => {
        btn.classList.toggle('active', ['daily', 'weekly', 'monthly'][i] === cat);
    });
    renderTasks();
    updateAnalytics();
}

function saveTasks() {
    const data = {
        tasks: state.tasks,
        completionHistory: state.completionHistory,
        assignments: state.assignments,
        dailyCompletionStats: state.dailyCompletionStats
    };
    localStorage.setItem('plannerData', JSON.stringify(data));
}

function loadTasks() {
    const data = JSON.parse(localStorage.getItem('plannerData') || '{"tasks":[],"completionHistory":{},"assignments":[],"dailyCompletionStats":{}}');
    state.tasks = data.tasks || [];
    state.completionHistory = data.completionHistory || {};
    state.dailyCompletionStats = data.dailyCompletionStats || {};
}

function loadAssignments() {
    const data = JSON.parse(localStorage.getItem('plannerData') || '{"assignments":[]}');
    state.assignments = data.assignments || [];
}

function toggleAssignmentForm() {
    const form = document.getElementById('assignmentForm');
    form.classList.toggle('active');
    if (form.classList.contains('active')) {
        document.getElementById('assignmentNameInput').focus();
    } else {
        document.getElementById('assignmentNameInput').value = '';
        document.getElementById('assignmentDateInput').value = '';
    }
}

function saveAssignment() {
    const nameInput = document.getElementById('assignmentNameInput');
    const dateInput = document.getElementById('assignmentDateInput');
    const name = nameInput.value.trim();
    const date = dateInput.value.trim();
    
    if (!name || !date) {
        if (!name) { nameInput.classList.add('shake'); setTimeout(() => nameInput.classList.remove('shake'), 450); }
        if (!date) { dateInput.classList.add('shake'); setTimeout(() => dateInput.classList.remove('shake'), 450); }
        return;
    }
    
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        dateInput.classList.add('shake');
        setTimeout(() => dateInput.classList.remove('shake'), 450);
        return;
    }
    
    state.assignments.push({
        id: Date.now(),
        name: name,
        dueDate: date,
        completed: false
    });
    
    saveTasks();
    renderAssignments();
    toggleAssignmentForm();
}

function toggleAssignmentComplete(id) {
    const assignment = state.assignments.find(a => a.id === id);
    if (assignment) {
        assignment.completed = !assignment.completed;
        saveTasks();
        renderAssignments();
    }
}

function deleteAssignment(id) {
    const assignment = state.assignments.find(a => a.id === id);
    if (!assignment) return;
    showBottomConfirm(`Delete "<b>${assignment.name}</b>"?`, () => {
        state.assignments = state.assignments.filter(a => a.id !== id);
        saveTasks();
        renderAssignments();
    });
}

function deleteHistoryTask(dateStr, taskText) {
    showBottomConfirm('Remove this task from history?', () => {
        if (state.completionHistory[dateStr]) {
            const data = state.completionHistory[dateStr];
            data.tasks = data.tasks.filter(t => {
                const tText = typeof t === 'string' ? t : t.text;
                return tText !== decodeURIComponent(taskText);
            });
            data.count = data.tasks.filter(t => typeof t === 'object' && t.completed).length;
            if (data.tasks.length === 0) {
                delete state.completionHistory[dateStr];
            }
            saveTasks();
            renderHistory();
        }
    });
}

window.deleteHistoryTask = deleteHistoryTask;

function showDateData(dateStr) {
    state.selectedDate = dateStr;
    renderTasksForDate();
    updateAnalytics();
    showHealthThatDay(dateStr);

    // If health page is currently visible, update it for this date
    const healthPage = document.getElementById('page2');
    if (healthPage && healthPage.classList.contains('active')) {
        initHealth(new Date(dateStr).toDateString());
    }
}

function showHealthThatDay(dateStr) {
    // Remove any existing health-that-day card first
    const existing = document.getElementById('healthThatDayCard');
    if (existing) existing.remove();

    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    const dateObj = new Date(dateStr);
    // getToday() uses .toDateString() format: "Wed Mar 6 2026"
    const dateKey = dateObj.toDateString();

    // Water key
    const water = localStorage.getItem(`water_${dateKey}`);

    // Supplements: count how many are true
    let suppTaken = 0;
    const suppTotal = SUPPLEMENTS.length;
    SUPPLEMENTS.forEach(supp => {
        if (localStorage.getItem(`supp_${supp.id}_${dateKey}`) === 'true') suppTaken++;
    });

    // Routine: count done items
    let routineTotal = 0, routineDone = 0;
    ROUTINE_ITEMS.forEach((section, sIdx) => {
        section.items.forEach((item, iIdx) => {
            routineTotal++;
            if (localStorage.getItem(`routine_${sIdx}_${iIdx}_${dateKey}`) === 'true') routineDone++;
        });
    });
    const routinePercent = routineTotal > 0 ? Math.round((routineDone / routineTotal) * 100) : null;

    // Journal - saved as journal_YYYY-MM-DD via getToday() which is toDateString
    // but saveJournal uses getToday() which is toDateString too - so key = journal_<toDateString>
    const journalText = localStorage.getItem(`journal_${dateKey}`) || '';

    const card = document.createElement('div');
    card.id = 'healthThatDayCard';
    card.className = 'health-that-day';

    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Only show if there's some data, or always show when date is selected
    const hasWater = water !== null;
    const hasSuppData = suppTaken > 0;
    const hasRoutine = routineDone > 0;

    card.innerHTML = `
        <div class="health-that-day-title">🏥 HEALTH THAT DAY</div>
        <div class="health-that-day-row">
            <div class="htd-item">
                <span>💧 Water</span>
                <span class="htd-val">${hasWater ? water + '/8' : '—'}</span>
            </div>
            <div class="htd-item">
                <span>💊 Supplements</span>
                <span class="htd-val">${hasSuppData || hasWater ? suppTaken + '/' + suppTotal : '—'}</span>
            </div>
            <div class="htd-item">
                <span>✅ Routine</span>
                <span class="htd-val">${hasRoutine || hasWater ? (routinePercent !== null ? routinePercent + '%' : '0%') : '—'}</span>
            </div>
            <div class="htd-item">
                <span>📝 Journal</span>
                <span class="htd-val ${journalText ? '' : 'none'}">${journalText ? 'Written ✓' : '(none)'}</span>
            </div>
        </div>
        ${journalText
            ? `<button class="htd-journal-btn" onclick="openJournalModal('${dateKey.replace(/'/g, "\\'")}', '${dateLabel}', '${dateKey.replace(/'/g, "\\'")}')">📖 Read Journal Entry</button>`
            : `<div class="htd-journal-btn no-journal">📝 No journal for this day</div>`
        }
    `;

    taskList.parentNode.insertBefore(card, taskList.nextSibling);
}

function openJournalModal(dateStr, dateLabel, dateKey) {
    const journalText = localStorage.getItem(`journal_${dateKey}`) || '';

    document.getElementById('jmTitle').textContent = '📝 Journal Entry';
    document.getElementById('jmDate').textContent = `📅 ${dateLabel || dateStr}`;
    document.getElementById('jmBody').textContent = journalText || '(No entry for this day)';

    // Health snapshot
    const water = localStorage.getItem(`water_${dateKey}`);
    let suppTaken = 0;
    SUPPLEMENTS.forEach(supp => {
        if (localStorage.getItem(`supp_${supp.id}_${dateKey}`) === 'true') suppTaken++;
    });
    let routineTotal = 0, routineDone = 0;
    ROUTINE_ITEMS.forEach((section, sIdx) => {
        section.items.forEach((item, iIdx) => {
            routineTotal++;
            if (localStorage.getItem(`routine_${sIdx}_${iIdx}_${dateKey}`) === 'true') routineDone++;
        });
    });
    const routinePercent = routineTotal > 0 ? Math.round((routineDone / routineTotal) * 100) : 0;

    const healthSection = document.getElementById('jmHealth');
    const healthRows = document.getElementById('jmHealthRows');
    healthSection.style.display = 'block';
    healthRows.innerHTML = `
        <div class="jm-health-item"><span>💧 Water</span><span>${water !== null ? water + '/8' : '—'}</span></div>
        <div class="jm-health-item"><span>💊 Supplements</span><span>${suppTaken}/${SUPPLEMENTS.length}</span></div>
        <div class="jm-health-item"><span>✅ Routine</span><span>${routinePercent}%</span></div>
    `;

    const modal = document.getElementById('journalModal');
    document.body.appendChild(modal);
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);';
}

function closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
    if (e.target.id === 'journalModal') closeJournalModal();
});

// ESC key to close
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeJournalModal();
});

function clearDateSelection() {
    state.selectedDate = null;
    const card = document.getElementById('healthThatDayCard');
    if (card) card.remove();
    renderTasks();
    updateAnalytics();
}

function renderTasksForDate() {
    const list = document.getElementById('taskList');
    
    const activeTasks = state.tasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate.toDateString() === state.selectedDate;
    });
    
    const historyData = state.completionHistory[state.selectedDate];

    const selectedDateObj = new Date(state.selectedDate);
    const dateHeader = `${days[selectedDateObj.getDay()]}, ${months[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}`;

    if (activeTasks.length === 0 && !historyData) {
        list.innerHTML = `
            <div style="padding: 10px 0; color: #4ade80; font-size: 12px; font-weight: 600; margin-bottom: 15px;">
                📅 ${dateHeader}
                <button onclick="clearDateSelection()" style="float: right; background: rgba(74, 222, 128, 0.2); border: 1px solid #4ade80; color: #4ade80; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Clear</button>
            </div>
            <div class="empty-state"><div class="empty-state-icon">📋</div><div>No tasks for this date</div></div>
        `;
        return;
    }

    list.innerHTML = `
        <div style="padding: 10px 0; color: #4ade80; font-size: 12px; font-weight: 600; margin-bottom: 15px;">
            📅 ${dateHeader}
            <button onclick="clearDateSelection()" style="float: right; background: rgba(74, 222, 128, 0.2); border: 1px solid #4ade80; color: #4ade80; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Clear</button>
        </div>
    `;

    if (activeTasks.length > 0) {
        activeTasks.forEach(task => {
            const el = document.createElement('div');
            el.className = `task-item ${task.completed ? 'completed' : ''}`;
            // Fix Bug #2: Properly escape task text to prevent empty display
            const escapedText = (task.text || '').replace(/[&<>"']/g, function(m) {
                return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#039;"}[m];
            });
            el.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <span class="task-text">${escapedText}</span>
                <span class="task-time">${task.completed && task.completedAt ? '✓ ' + task.completedAt : task.time}</span>
                <button class="task-delete">×</button>
            `;
            el.querySelector('.task-checkbox').onclick = () => toggleTask(task.id);
            el.querySelector('.task-delete').onclick = () => deleteTask(task.id);
            list.appendChild(el);
        });
    } 
    else if (historyData && historyData.tasks && historyData.tasks.length > 0) {
        historyData.tasks.forEach(task => {
            const taskText = typeof task === 'string' ? task : task.text;
            const isCompleted = (typeof task === 'object' && task.completed) ? true : false;
            
            const el = document.createElement('div');
            el.className = `task-item ${isCompleted ? 'completed' : ''}`;
            el.style.opacity = '0.7';
            el.style.pointerEvents = 'none';
            el.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} disabled>
                <span class="task-text">${taskText}</span>
                <span class="task-time" style="font-size: 10px; color: #64748b;">History</span>
            `;
            list.appendChild(el);
        });
    }
}

function renderTasks() {
    const list = document.getElementById('taskList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered;
    
    if (state.currentCategory === 'daily') {
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime() && t.category === 'daily';
        });
    } else if (state.currentCategory === 'weekly') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate >= startOfWeek && taskDate <= endOfWeek && t.category === 'weekly';
        });
    } else if (state.currentCategory === 'monthly') {
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            return taskDate.getMonth() === today.getMonth() && 
                   taskDate.getFullYear() === today.getFullYear() && 
                   t.category === 'monthly';
        });
    }

    if (!filtered.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div>No ${state.currentCategory} tasks yet</div></div>`;
        updateAnalytics();
        return;
    }

    list.innerHTML = '';
    filtered.forEach(task => {
        const el = document.createElement('div');
        el.className = `task-item ${task.completed ? 'completed' : ''}`;
        // Fix Bug #2: Properly escape task text to prevent empty display
        const escapedText = (task.text || '').replace(/[&<>"']/g, function(m) {
            return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#039;"}[m];
        });
        el.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${escapedText}</span>
            <span class="task-time">${task.completed && task.completedAt ? '✓ ' + task.completedAt : task.time}</span>
            <button class="task-delete">×</button>
        `;
        el.querySelector('.task-checkbox').onclick = () => toggleTask(task.id);
        el.querySelector('.task-delete').onclick = () => deleteTask(task.id);
        list.appendChild(el);
    });
    
    updateAnalytics();
}

function renderCalendar() {
    const cal = document.getElementById('calendar');
    const month = document.getElementById('calendarMonth');

    cal.innerHTML = '';
    month.textContent = `${months[state.currentDate.getMonth()]} ${state.currentDate.getFullYear()}`;

    days.forEach(d => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = d;
        cal.appendChild(h);
    });

    const firstDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0).getDate();
    const prevDays = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.innerHTML = `
            <div class="calendar-day-content">
                <span class="calendar-day-number">${prevDays - i}</span>
            </div>
        `;
        cal.appendChild(d);
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day';
        
        const dateToCheck = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), i);
        const dateKey = dateToCheck.toDateString();
        
        let stats = state.dailyCompletionStats[dateKey];
        
        if (!stats && state.completionHistory[dateKey]) {
            const historyData = state.completionHistory[dateKey];
            if (historyData.totalTasks > 0) {
                stats = {
                    total: historyData.totalTasks,
                    completed: historyData.count,
                    percentage: Math.round((historyData.count / historyData.totalTasks) * 100)
                };
            }
        }
        
        let fillHeight = 0;
        let percentageText = '';
        let colorClass = '';
        
        if (stats && stats.total > 0) {
            fillHeight = Math.floor(stats.percentage);
            percentageText = `${stats.percentage}%`;
            d.classList.add('has-completion');
            
            if (stats.percentage >= 80) {
                colorClass = 'completion-high';
            } else if (stats.percentage >= 50) {
                colorClass = 'completion-medium';
            } else {
                colorClass = 'completion-low';
            }
            d.classList.add(colorClass);
        }
        
        d.innerHTML = `
            <div class="calendar-day-content">
                <div class="calendar-day-fill" style="height: ${fillHeight}%"></div>
                <span class="calendar-day-number">${i}</span>
                ${percentageText ? `<span class="calendar-day-percentage">${percentageText}</span>` : ''}
            </div>
        `;

        if (state.currentDate.getMonth() === todayMonth && 
            state.currentDate.getFullYear() === todayYear && 
            i === todayDate) {
            d.classList.add('today');
        }

        d.onclick = function() {
            document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            showDateData(dateKey);
        };

        cal.appendChild(d);
    }

    const total = cal.querySelectorAll('.calendar-day, .calendar-day-header').length - 7;
    const remainingCells = Math.max(0, 42 - total);
    for (let i = 1; i <= remainingCells; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.innerHTML = `
            <div class="calendar-day-content">
                <span class="calendar-day-number">${i}</span>
            </div>
        `;
        cal.appendChild(d);
    }
}

function prevMonth() {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
}

function renderWeeklySchedule() {
    const schedule = document.getElementById('weeklySchedule');
    schedule.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dayName = days[d.getDay()];
        const dayNum = d.getDate();

        const tasksForDay = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            return taskDate.toDateString() === d.toDateString() && t.category === 'daily';
        }).length;

        const card = document.createElement('div');
        card.className = `day-card ${i === 0 ? 'active' : ''}`;
        card.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-date">${dayNum}</div>
            <div class="day-tasks">${tasksForDay} tasks</div>
        `;

        card.onclick = function() {
            document.querySelectorAll('.day-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        };

        schedule.appendChild(card);
    }
}

function updateAnalytics() {
    let targetDate;
    
    if (state.selectedDate) {
        targetDate = new Date(state.selectedDate);
    } else {
        targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);
    
    let filtered;
    let useHistory = false;
    
    if (state.currentCategory === 'daily') {
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === targetDate.getTime() && t.category === 'daily';
        });
        
        if (filtered.length === 0 && state.selectedDate) {
            const dateKey = targetDate.toDateString();
            const historyData = state.completionHistory[dateKey];
            
            if (historyData && historyData.tasks) {
                useHistory = true;
                filtered = historyData.tasks.map(t => ({
                    completed: (typeof t === 'object' && t.completed) ? true : false
                }));
            }
        }
    } else if (state.currentCategory === 'weekly') {
        const startOfWeek = new Date(targetDate);
        startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate >= startOfWeek && taskDate <= endOfWeek && t.category === 'weekly';
        });
    } else if (state.currentCategory === 'monthly') {
        filtered = state.tasks.filter(t => {
            const taskDate = new Date(t.date);
            return taskDate.getMonth() === targetDate.getMonth() && 
                   taskDate.getFullYear() === targetDate.getFullYear() && 
                   t.category === 'monthly';
        });
    }
    
    const completed = filtered.filter(t => t.completed).length;
    const total = filtered.length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('piePercentage').textContent = `${percentage}%`;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('categoryCount').textContent = filtered.length;
    document.getElementById('categoryLabel').textContent = state.currentCategory.charAt(0).toUpperCase() + state.currentCategory.slice(1);

    const pieChart = document.getElementById('pieChart');
    const degrees = (percentage / 100) * 360;
    pieChart.style.background = `conic-gradient(
        #4ade80 0deg,
        #4ade80 ${degrees}deg,
        rgba(74, 222, 128, 0.15) ${degrees}deg,
        rgba(74, 222, 128, 0.15) 360deg
    )`;
}

function renderAssignments() {
    const list = document.getElementById('assignmentsList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingAssignments = state.assignments
        .map(a => {
            const dueDate = new Date(a.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            return { ...a, dueDate, daysUntil };
        })
        .filter(a => a.daysUntil >= 0 || !a.completed)
        .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed - b.completed;
            return a.dueDate - b.dueDate;
        });

    if (upcomingAssignments.length === 0) {
        list.innerHTML = '<div class="history-empty">No upcoming assignments! 🎉</div>';
        return;
    }

    list.innerHTML = '';

    upcomingAssignments.forEach(a => {
        const isUrgent = a.daysUntil <= 2;
        const dueDateStr = a.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        let daysText = '';
        if (a.daysUntil === 0) {
            daysText = ' (Due Today!)';
        } else if (a.daysUntil === 1) {
            daysText = ' (Tomorrow)';
        } else if (a.daysUntil <= 7) {
            daysText = ` (${a.daysUntil} days)`;
        }

        const item = document.createElement('div');
        item.className = `assignment-item ${a.completed ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" class="assignment-checkbox" ${a.completed ? 'checked' : ''}>
            <div class="assignment-content">
                <div class="assignment-name">${a.name}</div>
                <div class="assignment-due ${isUrgent ? 'urgent' : ''}">Due: ${dueDateStr}${daysText}</div>
            </div>
            <button class="assignment-delete">×</button>
        `;
        item.querySelector('.assignment-checkbox').onclick = () => toggleAssignmentComplete(a.id);
        item.querySelector('.assignment-delete').onclick = () => deleteAssignment(a.id);
        list.appendChild(item);
    });
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const entries = Object.entries(state.completionHistory)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 10);

    if (entries.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No completion history yet</div>';
        return;
    }

    historyList.innerHTML = '';
    entries.forEach(([dateStr, data]) => {
        const date = new Date(dateStr);
        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        const dayNum = date.getDate();

        const completedCount = data.count || 0;
        const totalCount = data.totalTasks || data.tasks?.length || 0;
        const tasks = data.tasks || [];

        const item = document.createElement('div');
        item.className = 'history-item';
        
        let tasksHTML = '';
        if (tasks.length > 0) {
            tasksHTML = '<div class="history-tasks">';
            tasks.forEach(task => {
                const taskText = typeof task === 'string' ? task : task.text;
                const isCompleted = (typeof task === 'object' && task.completed) ? true : false;
                const escapedTask = taskText.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                
                const symbol = isCompleted ? '✓' : '✗';
                const symbolColor = isCompleted ? '#4ade80' : '#ef4444';
                const textDecoration = isCompleted ? 'line-through' : 'none';
                const textOpacity = isCompleted ? '0.6' : '1';
                
                tasksHTML += `
                    <div class="history-task ${isCompleted ? 'completed' : 'incomplete'}">
                        <div class="history-task-text" style="display: flex; align-items: center; gap: 6px;">
                            <span style="color: ${symbolColor}; font-weight: bold;">${symbol}</span>
                            <span style="text-decoration: ${textDecoration}; opacity: ${textOpacity};">${taskText}</span>
                        </div>
                        <button class="history-task-delete" onclick="deleteHistoryTask('${dateStr.replace(/'/g, "\\'")}', '${escapedTask}')">×</button>
                    </div>
                `;
            });
            tasksHTML += '</div>';
        }
        
        item.innerHTML = `
            <div class="history-header-row">
                <div class="history-day">${dayName}, ${monthName} ${dayNum}</div>
                <div class="history-count">${completedCount}/${totalCount} completed</div>
            </div>
            ${tasksHTML}
        `;
        historyList.appendChild(item);
    });
}

function getDaysSinceStart() {
    const startDate = new Date(2025, 11, 29);
    startDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    return daysPassed;
}


// PAGE NAVIGATION

function showPage(pageNum) {
    const currentPage = document.querySelector('.pages-container.active');
    const nextPage = document.getElementById(`page${pageNum}`);
    
    if (currentPage) currentPage.classList.remove('active');
    if (nextPage) nextPage.classList.add('active');
    
    document.querySelectorAll('.page-pill').forEach((btn, idx) => {
        btn.classList.toggle('active', idx + 1 === pageNum);
    });
    
    if (pageNum === 2) {
        const dateKey = state.selectedDate ? new Date(state.selectedDate).toDateString() : getToday();
        initHealth(dateKey);
    }
}


// HEALTH FUNCTIONS

const DEFAULT_SUPPLEMENTS = [
    { id: 'iron', name: 'Soaked Badam', emoji: '🌰', time: '' },
    { id: 'tea', name: 'Tea', emoji: '🍵', time: 'morning' },
    { id: 'fruits', name: 'Fruits', emoji: '🍎', time: 'night' },
];

let SUPPLEMENTS = JSON.parse(localStorage.getItem('customSupplements') || 'null') || DEFAULT_SUPPLEMENTS;

function saveSupplements() {
    localStorage.setItem('customSupplements', JSON.stringify(SUPPLEMENTS));
}

// ── SUPPLEMENT MANAGER ────
const EMOJI_OPTIONS = ['💊','☀️','🐟','⚡','🌙','🥣','🧴','🫐','🍋','🥦','🌿','🔬','💉','🧬','🫀','🧠','💪','🌱','🥕','🍵','🍎'];
let currentEmojiIndex = 0;
let selectedSuppTime = 'morning';  // Default time for new supplements
let suppAddSectionVisible = false;  // Track if add section is shown

function openSuppManager() {
    const modal = document.getElementById('suppModal');
    document.body.appendChild(modal);
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);';
    renderSuppModal();
}

function closeSuppManager() {
    const modal = document.getElementById('suppModal');
    modal.style.display = 'none';

    //  close toast when closing supplement manager
    const toast = document.getElementById('suppDeleteToast');
    if (toast) toast.classList.remove('show');

    document.getElementById('suppNameInput').value = '';
    currentEmojiIndex = 0;
    selectedSuppTime = 'morning';
    document.getElementById('suppEmojiBtn').textContent = EMOJI_OPTIONS[0];
    // Reset time button styles
    document.querySelectorAll('.supp-time-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector('[data-time="morning"]')?.classList.add('selected');
}

function renderSuppModal() {
    const container = document.getElementById('suppCategoriesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const times = [
        { id: 'morning', label: 'MORNING', emoji: '🌅', emptyMsg: 'Morning section with no supplements? That’s illegal!' },
        { id: 'afternoon', label: ' AFTERNOON', emoji: '☀️', emptyMsg: 'Afternoon update: supplements missing!' },
        { id: 'night', label: ' NIGHT', emoji: '🌙', emptyMsg: 'Night time and still no supplements. Peak consistency' }
    ];
    
    times.forEach(timeCategory => {
        // Filter supplements for this time
        const suppsForTime = SUPPLEMENTS.filter(s => (s.time || 'morning') === timeCategory.id);
        
        // Create category section
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'supp-time-category';
        
        // Add title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'supp-time-category-title';
        titleDiv.innerHTML = `${timeCategory.emoji} ${timeCategory.label}`;
        categoryDiv.appendChild(titleDiv);
        
        // Add items or empty state
        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'supp-time-category-items';
        
        if (suppsForTime.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 13px;';
            emptyDiv.textContent = timeCategory.emptyMsg;
            itemsDiv.appendChild(emptyDiv);
        } else {
            suppsForTime.forEach(supp => {
                const item = document.createElement('div');
                item.className = 'supp-modal-item';
                item.innerHTML = `
                    <span class="supp-modal-emoji">${supp.emoji}</span>
                    <span class="supp-modal-name">${supp.name}</span>
                    <button class="supp-modal-delete" onclick="confirmDeleteSupp('${supp.id}', '${supp.name.replace(/'/g,"\\'")}')">✕</button>
                `;
                itemsDiv.appendChild(item);
            });
        }
        
        categoryDiv.appendChild(itemsDiv);
        container.appendChild(categoryDiv);
    });
}

function selectSuppTime(time, element) {
    selectedSuppTime = time;
    document.querySelectorAll('.supp-time-btn').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
}

function cycleSuppEmoji() {
    currentEmojiIndex = (currentEmojiIndex + 1) % EMOJI_OPTIONS.length;
    document.getElementById('suppEmojiBtn').textContent = EMOJI_OPTIONS[currentEmojiIndex];
}

function cycleSuppCardEmoji() {
    currentEmojiIndex = (currentEmojiIndex + 1) % EMOJI_OPTIONS.length;
    document.getElementById('suppCardEmojiBtn').textContent = EMOJI_OPTIONS[currentEmojiIndex];
}

function selectSuppCardTime(time, element) {
    selectedSuppTime = time;
    document.querySelectorAll('.supp-card-time-button').forEach(btn => btn.classList.remove('selected'));
    element.classList.add('selected');
}

function addNewSuppCard() {
    const nameInput = document.getElementById('suppCardNameInput');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        setTimeout(() => nameInput.style.borderColor = '', 1200);
        return;
    }
    const emoji = document.getElementById('suppCardEmojiBtn').textContent;
    const id = 'custom_' + Date.now();
    SUPPLEMENTS.push({ id, name, emoji, time: selectedSuppTime });
    saveSupplements();
    nameInput.value = '';
    currentEmojiIndex = 0;
    selectedSuppTime = 'morning';
    document.getElementById('suppCardEmojiBtn').textContent = EMOJI_OPTIONS[0];
    document.querySelectorAll('.supp-card-time-button').forEach(btn => btn.classList.remove('selected'));
    document.querySelector('[data-time="morning"]')?.classList.add('selected');
    suppAddSectionVisible = false;  // Close form after adding
    updateSupplements();
    updateSupplementSummary();
}

function toggleSuppAddSection() {
    suppAddSectionVisible = !suppAddSectionVisible;
    updateSupplements();
}

function closeSuppCard() {
    const nameInput = document.getElementById('suppCardNameInput');
    if (nameInput) {
        nameInput.value = '';
        currentEmojiIndex = 0;
        selectedSuppTime = 'morning';
        document.getElementById('suppCardEmojiBtn').textContent = EMOJI_OPTIONS[0];
        document.querySelectorAll('.supp-card-time-button').forEach(btn => btn.classList.remove('selected'));
        document.querySelector('[data-time="morning"]')?.classList.add('selected');
    }
    suppAddSectionVisible = false;
    updateSupplements();
}

function addNewSupplement() {
    const nameInput = document.getElementById('suppNameInput');
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        setTimeout(() => nameInput.style.borderColor = '', 1200);
        return;
    }
    const emoji = document.getElementById('suppEmojiBtn').textContent;
    const id = 'custom_' + Date.now();
    SUPPLEMENTS.push({ id, name, emoji, time: selectedSuppTime });
    saveSupplements();
    nameInput.value = '';
    currentEmojiIndex = 0;
    selectedSuppTime = 'morning';
    document.getElementById('suppEmojiBtn').textContent = EMOJI_OPTIONS[0];
    document.querySelectorAll('.supp-time-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector('[data-time="morning"]')?.classList.add('selected');
    renderSuppModal();
    updateSupplements();
    updateSupplementSummary();
}

function confirmDeleteSupp(id, name) {
    pendingDeleteId = id;
    document.getElementById('suppDeleteMsg').innerHTML = `Delete <b>${name}</b>?`;
    document.getElementById('suppToastYes').onclick = () => executeDeleteSupp();
    const toast = document.getElementById('suppDeleteToast');
    toast.classList.add('show');
}

function deleteSupplement(id) {
    const supp = SUPPLEMENTS.find(s => s.id === id);
    if (supp) confirmDeleteSupp(id, supp.name);
}

function cancelSuppDelete() {
    pendingDeleteId = null;
    document.getElementById('suppDeleteToast').classList.remove('show');
}

function executeDeleteSupp() {
    if (!pendingDeleteId) return;
    SUPPLEMENTS = SUPPLEMENTS.filter(s => s.id !== pendingDeleteId);
    saveSupplements();
    pendingDeleteId = null;
    document.getElementById('suppDeleteToast').classList.remove('show');
    renderSuppModal();
    updateSupplements();
    updateSupplementSummary();
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
    if (e.target.id === 'suppModal') closeSuppManager();
});

// Close toast on Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cancelSuppDelete();
        closeSuppManager();
    }
});

let ROUTINE_ITEMS = JSON.parse(localStorage.getItem('customRoutine') || 'null') || [
    {
        section: '🌅 Morning',
        items: ['Water', 'Breakfast', 'Supplements', 'Stretch']
    },
    {
        section: '💻 Study',
        items: ['Green tea', 'Snack', 'Pomodoro', 'Eye care']
    },
    {
        section: '🌞 Afternoon',
        items: ['Healthy lunch', '30 min walk', 'Hydration']
    },
    {
        section: '🌙 Evening',
        items: ['Light dinner', 'Magnesium', 'Journal', 'Sleep prep']
    }
];

function getToday() {
    return new Date().toDateString();
}

function updateWaterDisplay(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    const count = parseInt(localStorage.getItem(`water_${key}`) || '0');
    const waterCount = document.getElementById('waterCount');
    const waterSummary = document.getElementById('waterSummary');
    const waterDots = document.getElementById('waterDots');
    
    if (!waterDots) return;
    
    if (waterCount) waterCount.textContent = count;
    if (waterSummary) waterSummary.textContent = count + '/8';
    
    waterDots.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const dot = document.createElement('div');
        dot.className = `water-dot ${i <= count ? 'active' : ''}`;
        dot.textContent = '💧';
        if (isToday) dot.onclick = () => toggleWater(i);
        else dot.style.cursor = 'default';
        waterDots.appendChild(dot);
    }

    // Show/hide water buttons
    const waterBtns = document.querySelector('.water-buttons');
    if (waterBtns) waterBtns.style.display = isToday ? 'flex' : 'none';
}

function toggleWater(n) {
    const today = getToday();
    const current = parseInt(localStorage.getItem(`water_${today}`) || '0');
    const newCount = current === n ? n - 1 : n;
    localStorage.setItem(`water_${today}`, Math.max(0, newCount));
    updateWaterDisplay();
}

function addWater() {
    const today = getToday();
    const current = parseInt(localStorage.getItem(`water_${today}`) || '0');
    localStorage.setItem(`water_${today}`, Math.min(8, current + 1));
    updateWaterDisplay();
}

function removeWater() {
    const today = getToday();
    const current = parseInt(localStorage.getItem(`water_${today}`) || '0');
    localStorage.setItem(`water_${today}`, Math.max(0, current - 1));
    updateWaterDisplay();
}

function updateSupplements(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    const container = document.getElementById('suppCardContent');
    if (!container) return;

    // Show/hide edit button based on isToday
    const editBtn = document.querySelector('.supp-edit-btn');
    if (editBtn) editBtn.style.display = isToday ? 'inline-block' : 'none';
    
    container.innerHTML = '';
    
    const times = [
        { id: 'morning', label: ' 🌅 MORNING', emoji: '🌅', emptyMsg: '  Nothing here!' },
        { id: 'afternoon', label: '☀️ AFTERNOON', emoji: '☀️', emptyMsg: 'Without food in afternoon?' },
        { id: 'night', label: '🌙 NIGHT', emoji: '🌙', emptyMsg: 'Thinakunda em sadidam ani ra?' }
    ];
    
    times.forEach((timeCategory, idx) => {
        // Filter supplements for this time
        const suppsForTime = SUPPLEMENTS.filter(s => (s.time || 'morning') === timeCategory.id);
        
        // Create time section
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'supp-card-time-section';
        
        // Add title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'supp-card-time-header';
        titleDiv.textContent = timeCategory.label;
        sectionDiv.appendChild(titleDiv);
        
        // Add items
        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'supp-card-items';
        
        if (suppsForTime.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 13px;';
            emptyDiv.textContent = timeCategory.emptyMsg;
            itemsDiv.appendChild(emptyDiv);
        } else {
            suppsForTime.forEach(supp => {
                const isTaken = localStorage.getItem(`supp_${supp.id}_${key}`) === 'true';
                const item = document.createElement('div');
                item.className = `supp-card-item ${isTaken ? 'taken' : ''}`;
                if (!isToday) item.style.opacity = isTaken ? '1' : '0.6';
                item.innerHTML = `
                    <div class="supp-card-checkbox">${isTaken ? '✓' : ''}</div>
                    <span class="supp-card-emoji">${supp.emoji}</span>
                    <span class="supp-card-name">${supp.name}</span>
                    <button class="supp-card-delete" onclick="event.stopPropagation(); deleteSupplement('${supp.id}')" ${isToday ? '' : 'disabled style="opacity: 0.3; cursor: not-allowed;"'}>✕</button>
                `;
                if (isToday) item.onclick = () => toggleSupplement(supp.id);
                else item.style.cursor = 'default';
                itemsDiv.appendChild(item);
            });
        }
        sectionDiv.appendChild(itemsDiv);
        container.appendChild(sectionDiv);
        
        // Add divider between sections
        if (idx < times.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'supp-card-divider';
            container.appendChild(divider);
        }
    });
}
function updateSupplementSummary(dateKey) {
    const key = dateKey || getToday();
    let takenCount = 0;
    
    SUPPLEMENTS.forEach(supp => {
        const isTaken = localStorage.getItem(`supp_${supp.id}_${key}`) === 'true';
        if (isTaken) takenCount++;
    });
    
    const summaryEl = document.getElementById('suppSummary');
    if (summaryEl) {
        summaryEl.textContent = `${takenCount}/${SUPPLEMENTS.length}`;
    }
}

function toggleSupplement(id) {
    const today = getToday();
    const key = `supp_${id}_${today}`;
    const current = localStorage.getItem(key) === 'true';
    localStorage.setItem(key, !current);
    updateSupplements();
    updateSupplementSummary();
    updateRoutineProgress();
}

function updateRoutine(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    const container = document.getElementById('routineSections');
    if (!container) return;
    
    container.innerHTML = '';
    
    ROUTINE_ITEMS.forEach((section, sIdx) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'routine-section';
        sectionDiv.innerHTML = `<div class="routine-section-title">${section.section}</div>`;
        
        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'routine-items';
        
        section.items.forEach((item, iIdx) => {
            const rKey = `routine_${sIdx}_${iIdx}_${key}`;
            const isDone = localStorage.getItem(rKey) === 'true';
            
            const itemEl = document.createElement('div');
            itemEl.className = `routine-item ${isDone ? 'done' : ''}`;
            if (!isToday && !isDone) itemEl.style.opacity = '0.4';
            itemEl.innerHTML = `
                <div class="routine-checkbox">${isDone ? '✓' : ''}</div>
                <span class="routine-text">${item}</span>
            `;
            if (isToday) itemEl.onclick = () => toggleRoutineItem(sIdx, iIdx);
            else itemEl.style.cursor = 'default';
            itemsDiv.appendChild(itemEl);
        });
        
        sectionDiv.appendChild(itemsDiv);
        container.appendChild(sectionDiv);
    });
    
    updateRoutineProgress(key);
}

function toggleRoutineItem(sIdx, iIdx) {
    const today = getToday();
    const key = `routine_${sIdx}_${iIdx}_${today}`;
    const current = localStorage.getItem(key) === 'true';
    localStorage.setItem(key, !current);
    updateRoutine();
}

function updateRoutineProgress(dateKey) {
    const key = dateKey || getToday();
    let totalItems = 0;
    let doneItems = 0;
    
    ROUTINE_ITEMS.forEach((section, sIdx) => {
        section.items.forEach((item, iIdx) => {
            totalItems++;
            if (localStorage.getItem(`routine_${sIdx}_${iIdx}_${key}`) === 'true') doneItems++;
        });
    });
    
    const percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
    const el = document.getElementById('routinePercent');
    if (el) el.textContent = percent;
    const sumEl = document.getElementById('routineSummary');
    if (sumEl) sumEl.textContent = percent + '%';
}

function loadJournal(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    const entry = localStorage.getItem(`journal_${key}`) || '';
    const textArea = document.getElementById('journalText');
    const saveBtn = document.querySelector('.journal-save-btn');
    const label = document.querySelector('.journal-label');

    if (textArea) {
        textArea.value = entry;
        textArea.readOnly = !isToday;
        textArea.style.opacity = isToday ? '1' : '0.75';
        textArea.style.cursor = isToday ? 'text' : 'default';
        if (!isToday) textArea.placeholder = entry ? '' : '(No journal written this day)';
    }
    if (saveBtn) saveBtn.style.display = isToday ? 'block' : 'none';
    if (label) label.textContent = isToday ? 'How was today?' : 'Journal entry';
}

function saveJournal() {
    const today = getToday();
    const textArea = document.getElementById('journalText');
    if (!textArea) return;
    
    const text = textArea.value;
    localStorage.setItem(`journal_${today}`, text);
    
    const saved = document.getElementById('journalSaved');
    if (saved) {
        saved.classList.add('show');
        setTimeout(() => saved.classList.remove('show'), 2000);
    }
}

function initHealth(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    document.querySelectorAll('.supp-edit-btn, .routine-edit-btn').forEach(btn => {
        btn.style.display = isToday ? 'inline-block' : 'none';
    });

    updateWaterDisplay(key);
    updateSupplements(key);
    updateSupplementSummary(key);
    updateRoutine(key);
    loadJournal(key);
    loadMood(key);
    updateStreak();
    renderDailyTip();
    updateMedSessions();
    updateMedDisplay();

    // Show/hide view banner
    let banner = document.getElementById('healthViewBanner');
    if (!isToday) {
        const dateObj = new Date(key);
        const label = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'healthViewBanner';
            banner.style.cssText = `
                background: rgba(255,180,0,0.1);
                border: 1px solid rgba(255,180,0,0.3);
                border-radius: 10px;
                padding: 10px 16px;
                margin: 0 20px 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                color: #ffd700;
                font-weight: 600;
            `;
            const grid = document.querySelector('.health-grid');
            if (grid) grid.parentNode.insertBefore(banner, grid);
        }
        banner.innerHTML = `
            <span>👁 Viewing: ${label} — Read Only</span>
            <button onclick="clearHealthDateView()" style="background:rgba(255,180,0,0.2);border:1px solid rgba(255,180,0,0.4);color:#ffd700;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;">✕ Back to Today</button>
        `;
        banner.style.display = 'flex';
    } else {
        if (banner) banner.style.display = 'none';
    }
}

function clearHealthDateView() {
    state.selectedDate = null;
    const card = document.getElementById('healthThatDayCard');
    if (card) card.remove();
    initHealth();
    // Also clear calendar selection
    document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
    renderTasks();
    updateAnalytics();
}

// ── MOOD LOGGER ─────────────
function setMood(emoji, label) {
    const today = getToday();
    const current = JSON.parse(localStorage.getItem(`mood_${today}`) || 'null');

    // If same mood clicked again → deselect
    if (current && current.emoji === emoji) {
        localStorage.removeItem(`mood_${today}`);
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
        const saved = document.getElementById('moodSaved');
        if (saved) { saved.textContent = ''; }
        return;
    }

    localStorage.setItem(`mood_${today}`, JSON.stringify({ emoji, label }));

    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mood === emoji);
    });

    const saved = document.getElementById('moodSaved');
    if (saved) {
        saved.textContent = `${emoji} ${label} — saved!`;
        setTimeout(() => { saved.textContent = ''; }, 2500);
    }
}

function loadMood(dateKey) {
    const key = dateKey || getToday();
    const isToday = key === getToday();
    const data = JSON.parse(localStorage.getItem(`mood_${key}`) || 'null');

    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.toggle('selected', data ? btn.dataset.mood === data.emoji : false);
        if (!isToday) {
            btn.style.cursor = 'default';
            btn.onclick = null;
            if (!data || btn.dataset.mood !== data.emoji) btn.style.opacity = '0.35';
            else btn.style.opacity = '1';
        } else {
            btn.style.cursor = 'pointer';
            btn.style.opacity = '1';
            const mood = btn.dataset.mood;
            const label = btn.dataset.label;
            btn.onclick = () => setMood(mood, label);
        }
    });

    const saved = document.getElementById('moodSaved');
    if (saved) {
        if (data) saved.textContent = isToday ? `Today: ${data.emoji} ${data.label}` : `${data.emoji} ${data.label}`;
        else saved.textContent = isToday ? '' : '(no mood logged)';
    }
}

// ── MEDITATION TIMER ───────────
const medState = {
    duration: 5 * 60,
    remaining: 5 * 60,
    isRunning: false,
    interval: null,
};

const CIRCUMFERENCE = 2 * Math.PI * 52; // 326.7

function setMedPreset(minutes, btn) {
    if (medState.isRunning) return;
    document.querySelectorAll('.med-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    medState.duration = minutes * 60;
    medState.remaining = minutes * 60;
    updateMedDisplay();
}

function toggleMeditation() {
    if (medState.isRunning) {
        pauseMeditation();
    } else {
        startMeditation();
    }
}

function startMeditation() {
    if (medState.remaining <= 0) resetMeditation();
    medState.isRunning = true;
    document.getElementById('medStartBtn').textContent = '⏸ Pause';
    document.getElementById('medStatus').textContent = 'Breathing...';
    document.getElementById('medStatus').classList.add('running');

    medState.interval = setInterval(() => {
        medState.remaining--;
        updateMedDisplay();
        if (medState.remaining <= 0) {
            completeMeditation();
        }
    }, 1000);
}

function pauseMeditation() {
    clearInterval(medState.interval);
    medState.isRunning = false;
    document.getElementById('medStartBtn').textContent = '▶ Resume';
    document.getElementById('medStatus').textContent = 'Paused';
    document.getElementById('medStatus').classList.remove('running');
}

function resetMeditation() {
    clearInterval(medState.interval);
    medState.isRunning = false;
    medState.remaining = medState.duration;
    document.getElementById('medStartBtn').textContent = '▶ Start';
    document.getElementById('medStatus').textContent = 'Ready';
    document.getElementById('medStatus').classList.remove('running');
    updateMedDisplay();
}

function completeMeditation() {
    clearInterval(medState.interval);
    medState.isRunning = false;
    medState.remaining = 0;
    document.getElementById('medStartBtn').textContent = '▶ Start';
    document.getElementById('medStatus').textContent = 'You did Sowmya😉';
    document.getElementById('medStatus').classList.remove('running');
    updateMedDisplay();

    // Save session
    const today = getToday();
    const sessions = JSON.parse(localStorage.getItem(`med_sessions_${today}`) || '{"count":0,"minutes":0}');
    sessions.count++;
    sessions.minutes += Math.floor(medState.duration / 60);
    localStorage.setItem(`med_sessions_${today}`, JSON.stringify(sessions));
    updateMedSessions();

   [0, 0.5, 1.0].forEach(delay => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 528;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 1.2);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 1.2);
});
    setTimeout(() => resetMeditation(), 2000);
}

function updateMedDisplay() {
    const mins = String(Math.floor(medState.remaining / 60)).padStart(2, '0');
    const secs = String(medState.remaining % 60).padStart(2, '0');
    document.getElementById('medTimeDisplay').textContent = `${mins}:${secs}`;

    const progress = medState.remaining / medState.duration;
    const offset = CIRCUMFERENCE * (1 - progress);
    const ring = document.getElementById('medRingProgress');
    if (ring) ring.style.strokeDashoffset = offset;
}

function updateMedSessions() {
    const today = getToday();
    const sessions = JSON.parse(localStorage.getItem(`med_sessions_${today}`) || '{"count":0,"minutes":0}');
    const countEl = document.getElementById('medSessionCount');
    const timeEl = document.getElementById('medTotalTime');
    if (countEl) countEl.textContent = sessions.count;
    if (timeEl) timeEl.textContent = sessions.minutes + ' min';
}
function updateStreak() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build a Set of all dates that had at least 1 completed task
    const activeDates = new Set();

    // From completionHistory (past days saved)
    Object.entries(state.completionHistory).forEach(([dateStr, data]) => {
        const tasks = data.tasks || [];
        const hasCompleted = tasks.some(t => (typeof t === 'object' ? t.completed : false));
        if (hasCompleted || (data.count && data.count > 0)) {
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            activeDates.add(d.getTime());
        }
    });

    // From current live tasks (today)
    const todayCompleted = state.tasks.some(t => {
        const td = new Date(t.date);
        td.setHours(0, 0, 0, 0);
        return td.getTime() === today.getTime() && t.completed;
    });
    if (todayCompleted) activeDates.add(today.getTime());

    // Count consecutive days going backwards from today
    let streak = 0;
    let check = new Date(today);

    // If today has no tasks yet, still check from yesterday
    if (!activeDates.has(today.getTime())) {
        check.setDate(check.getDate() - 1);
    }

    while (activeDates.has(check.getTime())) {
        streak++;
        check.setDate(check.getDate() - 1);
    }

    // Best streak
    const savedBest = parseInt(localStorage.getItem('bestStreak') || '0');
    const best = Math.max(savedBest, streak);
    localStorage.setItem('bestStreak', best);

    // Update UI
    const streakEl = document.getElementById('streakDisplay');
    const streakSumEl = document.getElementById('streakSummary');
    const bestEl = document.querySelector('.streak-best');

    if (streakEl) streakEl.textContent = streak;
    if (streakSumEl) streakSumEl.textContent = streak;
    if (bestEl) bestEl.textContent = `Best: ${best} days`;
}

// ── 30-DAY MOTIVATIONAL TIPS ───────────────────────────────
const DAILY_TIPS = [
    { title: "🔥 Break The Barrier", text: "The hardest part is starting. One task. One sip of water. One minute of movement. Break the initial resistance. 🚀" },
    { title: "⚡ Show Up Every Day", text: "You don't need to be perfect. You just need to show up. Consistency beats motivation every single time." },
    { title: "🧠 Discipline > Feelings", text: "Motivation is a guest. Discipline is family. Do the work even when you don't feel like it — especially then." },
    { title: "🌱 Small Wins Stack", text: "One completed task today + one tomorrow = unstoppable momentum. Never underestimate the power of small wins." },
    { title: "💧 Fuel Your Brain", text: "Your brain is 75% water. Dehydration kills focus and mood. Drink water before you do anything else today." },
    { title: "🎯 One Thing Rule", text: "What's the ONE thing you must do today that makes everything else easier? Do that first. Everything else is secondary." },
    { title: "🌅 Win The Morning", text: "How you start your morning sets the tone for your entire day. Water → move → eat → study. No phone for 30 minutes." },
    { title: "💪 Build The Habit", text: "After 66 days, a habit becomes automatic. You're not just doing tasks — you're building who you'll be forever." },
    { title: "🔑 Protect Your Energy", text: "Say no to things that drain you. Say yes to sleep, movement, and good food. Energy is your most valuable asset." },
    { title: "📚 Learn Daily", text: "30 minutes of focused learning every day = 180 hours a year. That's a superpower most people don't use." },
    { title: "🧘 Control The Controllable", text: "Don't stress about things outside your control. Focus 100% on your actions, your effort, your attitude. That's it." },
    { title: "🌙 Sleep Is Not Laziness", text: "Sleep is when your brain consolidates memory. 7-9 hours isn't a luxury — it's your competitive advantage." },
    { title: "🚶 Move Your Body", text: "30 minutes of movement increases focus, reduces stress, and boosts mood for hours. It's free medicine. Take it." },
    { title: "🔄 Embrace The Grind", text: "The boring, repetitive work is exactly what separates winners from dreamers. Embrace it. Love it. Do it anyway." },
    { title: "⏰ Time Is The Asset", text: "Every hour you waste is an hour you can't get back. Spend it like it's gold — because it is." },
    { title: "🎖️ Identity First", text: "Don't say 'I'm trying to study.' Say 'I AM a student.' Your identity drives your actions. Own who you are becoming." },
    { title: "🧱 Stack Your Bricks", text: "Great walls are built one brick at a time. Great lives are built one good decision at a time. Lay your brick today." },
    { title: "🔥 Hunger For Growth", text: "Stay hungry. The moment you think you know enough is the moment you stop growing. Always be a student." },
    { title: "💡 Reflect Every Night", text: "3 questions before bed: What did I learn? What did I do well? What will I improve tomorrow? Journal it. Grow it." },
    { title: "🏆 Future Self First", text: "Before any decision ask — will my future self thank me for this? Let that answer guide you every single time." },
    { title: "🌊 Flow State", text: "Deep work beats shallow work every time. Silence your phone, close the tabs, set the timer — go all in for 25 minutes." },
    { title: "💊 Invest In Health", text: "Your body is the vehicle for all your dreams. Feed it well, move it daily, rest it fully. No shortcuts." },
    { title: "🧩 Systems Win", text: "Goals tell you where to go. Systems get you there. Build your daily system and trust the process." },
    { title: "🌟 You Are The Project", text: "The most important project you'll ever work on is yourself. Invest in it like your life depends on it — it does." },
    { title: "🔐 Lock In", text: "Stop waiting for the perfect moment. The perfect moment is right now, with what you have, where you are." },
    { title: "⚔️ Hard Days Build You", text: "The days you least want to work are the days that define you the most. Show up hard on hard days." },
    { title: "📊 Track To Win", text: "What gets measured gets improved. Your streak, your water, your routine — tracking turns vague goals into real wins." },
    { title: "🎯 Ruthless Focus", text: "Multitasking is a myth. One task, full focus, no distractions. That single session will outperform a distracted hour." },
    { title: "🌍 Think Long Term", text: "The person who plants a tree knowing they won't sit in its shade is a person who understands legacy. Build for the long game." },
    { title: "🚀 You've Already Started", text: "The fact that you're tracking your habits means you're already ahead of 90% of people. Keep going. Don't stop now." },
];

function renderDailyTip() {
    const tipTitle = document.querySelector('.tip-title');
    const tipText = document.querySelector('.tip-text');
    if (!tipTitle || !tipText) return;

    // Use day of year so tip changes daily and cycles through all 30
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const tip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];

    tipTitle.textContent = tip.title;
    tipText.textContent = tip.text;
}

// NOTIFICATION TOAST (top-right)

function showNotifToast(type, icon, title, msg, duration) {
    const toast = document.getElementById('notifToast');
    document.getElementById('notifToastIcon').textContent = icon;
    document.getElementById('notifToastTitle').textContent = title;
    document.getElementById('notifToastMsg').textContent = msg;
    toast.className = `notif-toast ${type} show`;
    if (notifToastTimer) clearTimeout(notifToastTimer);
    if (duration > 0) {
        notifToastTimer = setTimeout(() => closeNotifToast(), duration);
    }
}

function closeNotifToast() {
    document.getElementById('notifToast').classList.remove('show');
    if (notifToastTimer) clearTimeout(notifToastTimer);
}

// ── GENERIC BOTTOM CONFIRM TOAST 

let bottomConfirmCallback = null;

function showBottomConfirm(message, onConfirm) {
    bottomConfirmCallback = onConfirm;
    const toast = document.getElementById('suppDeleteToast');
    document.body.appendChild(toast);
    document.getElementById('suppDeleteMsg').innerHTML = message;
    document.getElementById('suppToastYes').textContent = 'Yes, Delete';
    document.getElementById('suppToastYes').onclick = () => {
        if (bottomConfirmCallback) bottomConfirmCallback();
        bottomConfirmCallback = null;
        toast.classList.remove('show');
    };
    toast.classList.add('show');
}

// Close reset modal on overlay click
document.addEventListener('click', function(e) {
    if (e.target.id === 'resetModal') closeResetModal();
});

// Fix Bug #1: Close task menu when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.task-item') && !e.target.closest('.task-delete')) {
        // Click outside - close any editing/delete state
        document.querySelectorAll('.task-item').forEach(item => {
            item.classList.remove('editing');
        });
    }
});

// ROUTINE MANAGER
let selectedRoutineSection = 0;

function openroutine() {
    const modal = document.getElementById('routineModal');
    document.body.appendChild(modal);
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(6px);';
    renderRoutineModal();
}

function closeRoutineManager() {
    document.getElementById('routineModal').style.display = 'none';
    document.getElementById('routineItemInput').value = '';
}

function selectRoutineSection(idx, btn) {
    selectedRoutineSection = idx;
    document.querySelectorAll('#routineModal .supp-time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function renderRoutineModal() {
    const container = document.getElementById('routineModalContent');
    container.innerHTML = '';

    ROUTINE_ITEMS.forEach((section, sIdx) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'supp-time-category';

        const title = document.createElement('div');
        title.className = 'supp-time-category-title';
        title.textContent = section.section;
        sectionDiv.appendChild(title);

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'supp-time-category-items';

        if (section.items.length === 0) {
            itemsDiv.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-tertiary); font-size:13px;">No items yet</div>';
        } else {
            section.items.forEach((item, iIdx) => {
                const el = document.createElement('div');
                el.className = 'supp-modal-item';
                el.innerHTML = `
                    <span class="supp-modal-emoji">✅</span>
                    <span class="supp-modal-name">${item}</span>
                    <button class="supp-modal-delete" onclick="deleteRoutineItem(${sIdx}, ${iIdx})">✕</button>
                `;
                itemsDiv.appendChild(el);
            });
        }

        sectionDiv.appendChild(itemsDiv);
        container.appendChild(sectionDiv);
    });
}

function addRoutineItem() {
    const input = document.getElementById('routineItemInput');
    const name = input.value.trim();
    if (!name) {
        input.style.borderColor = '#ef4444';
        input.focus();
        setTimeout(() => input.style.borderColor = '', 1200);
        return;
    }
    ROUTINE_ITEMS[selectedRoutineSection].items.push(name);
    saveRoutineItems();
    input.value = '';
    renderRoutineModal();
    updateRoutine();
}

function deleteRoutineItem(sIdx, iIdx) {
    showBottomConfirm(`Delete "<b>${ROUTINE_ITEMS[sIdx].items[iIdx]}</b>"?`, () => {
        ROUTINE_ITEMS[sIdx].items.splice(iIdx, 1);
        saveRoutineItems();
        renderRoutineModal();
        updateRoutine();
    });
}

function saveRoutineItems() {
    localStorage.setItem('customRoutine', JSON.stringify(ROUTINE_ITEMS));
}
// NOTIFICATION SETTINGS
function openNotifSettings() {
    const modal = document.getElementById('notifSettingsModal');
    modal.style.cssText = 'display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(6px);';
    
    // Load saved settings into inputs
    const slots = ['morning', 'afternoon', 'evening', 'final'];
    const defaults = ['09:00', '14:00', '20:00', '23:00'];
    
    slots.forEach((slot, i) => {
        const saved = JSON.parse(localStorage.getItem(`notif_${slot}`) || 'null');
        document.getElementById(`notif_${slot}_time`).value = saved ? saved.time : defaults[i];
        document.getElementById(`notif_${slot}_enabled`).checked = saved ? saved.enabled : true;
    });
}

function closeNotifSettings() {
    document.getElementById('notifSettingsModal').style.display = 'none';
}

function saveNotifSettings() {
    const slots = ['morning', 'afternoon', 'evening', 'final'];
    const todayKey = new Date().toDateString(); 
    slots.forEach(slot => {
        const time = document.getElementById(`notif_${slot}_time`).value;
        const enabled = document.getElementById(`notif_${slot}_enabled`).checked;
        localStorage.setItem(`notif_${slot}`, JSON.stringify({ time, enabled }));
        localStorage.removeItem(`notified_${slot}_${todayKey}`);  
    });
    closeNotifSettings();
    showNotifToast('success', '🔔', 'Saved!', 'Notification times updated!', 3000);
}

function checkTaskNotification() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayKey = now.toDateString();

    const today = new Date();
    today.setHours(0,0,0,0);

    const pendingTasks = state.tasks.filter(t => {
        const td = new Date(t.date);
        td.setHours(0,0,0,0);
        return td.getTime() === today.getTime() && t.category === 'daily' && !t.completed;
    });

    const slots = ['morning', 'afternoon', 'evening', 'final'];
    const messages = {
        morning: '🌅 Good morning! Check your tasks!',
        afternoon: '☀️ Afternoon check! How are tasks going?',
        evening: '🌙 Evening check! Tasks pending?',
        final: '🚨 Final call! Complete your tasks!'
    };

    slots.forEach(slot => {
        const saved = JSON.parse(localStorage.getItem(`notif_${slot}`) || 'null');
        if (!saved || !saved.enabled) return;
        
        const alreadyNotified = localStorage.getItem(`notified_${slot}_${todayKey}`);
        if (alreadyNotified) return;
        
        if (currentTime === saved.time) {
            localStorage.setItem(`notified_${slot}_${todayKey}`, 'true');
            
            const body = pendingTasks.length > 0 
                ? `${pendingTasks.length} tasks pending:\n${pendingTasks.map(t => '• ' + t.text).join('\n')}`
                : '✅ All tasks completed! Great job!';
            
            const notif = new Notification(messages[slot], { body });
            notif.onclick = function() {
                window.focus();
            };
        }
    });
}

window.addEventListener('load', init);