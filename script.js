// Hardcoded API key (provided by user)
const GEMINI_API_KEY = 'AIzaSyAtWkG0LoxtA9lrtvqenkwuxCyzhzvkHzc';

// User Authentication & Data Management
class UserManager {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('momentumx_users')) || {};
        this.demoUser = {
            username: 'demo',
            password: 'demo123',
            email: 'demo@momentumx.app',
            joinDate: '2025-01-01'
        };
    }

    register(username, email, password, confirmPassword) {
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        if (this.users[username]) {
            throw new Error('Username already exists');
        }

        if (username.length < 3) {
            throw new Error('Username must be at least 3 characters');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const user = {
            username,
            email,
            password, // In a real app, this would be hashed
            joinDate: new Date().toISOString().split('T')[0],
            data: this.getDefaultUserData()
        };

        this.users[username] = user;
        this.saveUsersToFile();
        return user;
    }

    login(username, password) {
        // Check demo user
        if (username === this.demoUser.username && password === this.demoUser.password) {
            const demoUserData = {
                ...this.demoUser,
                data: this.getDemoUserData()
            };
            this.currentUser = demoUserData;
            localStorage.setItem('momentumx_currentUser', JSON.stringify(demoUserData));
            return demoUserData;
        }

        const user = this.users[username];
        if (!user || user.password !== password) {
            throw new Error('Invalid username or password');
        }

        this.currentUser = user;
        localStorage.setItem('momentumx_currentUser', JSON.stringify(user));
        return user;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('momentumx_currentUser');
    }

    getCurrentUser() {
        if (!this.currentUser) {
            const savedUser = localStorage.getItem('momentumx_currentUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
            }
        }
        return this.currentUser;
    }

    updateUserData(data) {
        if (!this.currentUser) return;

        if (this.currentUser.username === 'demo') {
            // For demo user, just save to localStorage
            this.currentUser.data = { ...this.currentUser.data, ...data };
            localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));
        } else {
            // For registered users, update in users database
            this.currentUser.data = { ...this.currentUser.data, ...data };
            this.users[this.currentUser.username] = this.currentUser;
            this.saveUsersToFile();
            localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));
        }
    }

    saveUsersToFile() {
        try {
            // Save to localStorage as backup
            localStorage.setItem('momentumx_users', JSON.stringify(this.users));
            
            // Create and download JSON file
            const dataStr = JSON.stringify({
                users: this.users,
                lastUpdated: new Date().toISOString()
            }, null, 2);
            
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            // Create hidden download link
            const link = document.createElement('a');
            link.href = url;
            link.download = 'momentumx_users_database.json';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error saving users to file:', error);
            // Fallback to localStorage only
            localStorage.setItem('momentumx_users', JSON.stringify(this.users));
        }
    }

    getDefaultUserData() {
        return {
            machines: [],
            splitType: 'upper-lower',
            difficulty: 'intermediate',
            dayOverride: 'auto',
            workoutsGenerated: 0,
            currentStreak: 0,
            lastWorkoutDate: null,
            totalWorkoutTime: 0
        };
    }

    getDemoUserData() {
        return {
            machines: [
                'Bench Press', 'Lat Pulldown', 'Leg Press', 'Shoulder Press',
                'Cable Rows', 'Leg Curl', 'Leg Extension', 'Chest Fly',
                'Bicep Curl Machine', 'Tricep Dips', 'Smith Machine', 'Cable Machine'
            ],
            splitType: 'push-pull-legs',
            difficulty: 'intermediate',
            dayOverride: 'auto',
            workoutsGenerated: 15,
            currentStreak: 3,
            lastWorkoutDate: new Date().toISOString().split('T')[0],
            totalWorkoutTime: 12.5
        };
    }
}

// Initialize user manager
const userManager = new UserManager();

// Application state
let appState = {
    currentUser: null,
    currentDay: new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
};

// DOM elements - will be initialized in init()
let elements = {};

// Split configurations - Enhanced with more options
const splitConfigs = {
    'upper-lower': {
        pattern: ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower', 'Rest'],
        focuses: {
            'Upper': 'Chest, Back, Shoulders, Arms',
            'Lower': 'Legs, Glutes, Calves',
            'Rest': 'Recovery Day'
        }
    },
    'push-pull-legs': {
        pattern: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'],
        focuses: {
            'Push': 'Chest, Shoulders, Triceps',
            'Pull': 'Back, Biceps',
            'Legs': 'Quads, Hamstrings, Glutes, Calves',
            'Rest': 'Recovery Day'
        }
    },
    'full-body': {
        pattern: ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'],
        focuses: {
            'Full Body': 'Total Body Workout',
            'Rest': 'Recovery Day'
        }
    },
    'bro-split': {
        pattern: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Rest', 'Rest'],
        focuses: {
            'Chest': 'Chest and Triceps',
            'Back': 'Back and Biceps',
            'Legs': 'Legs and Glutes',
            'Shoulders': 'Shoulders and Traps',
            'Arms': 'Biceps and Triceps',
            'Rest': 'Recovery Day'
        }
    }
};

// Day override mapping
const dayOverrideMapping = {
    'upper': { type: 'Upper', focus: 'Chest, Back, Shoulders, Arms' },
    'lower': { type: 'Lower', focus: 'Legs, Glutes, Calves' },
    'push': { type: 'Push', focus: 'Chest, Shoulders, Triceps' },
    'pull': { type: 'Pull', focus: 'Back, Biceps' },
    'legs': { type: 'Legs', focus: 'Quads, Hamstrings, Glutes, Calves' },
    'chest': { type: 'Chest', focus: 'Chest and Triceps' },
    'back': { type: 'Back', focus: 'Back and Biceps' },
    'shoulders': { type: 'Shoulders', focus: 'Shoulders and Traps' },
    'arms': { type: 'Arms', focus: 'Biceps and Triceps' },
    'full-body': { type: 'Full Body', focus: 'Total Body Workout' }
};

// Initialize DOM elements
function initElements() {
    elements = {
        // Auth elements
        authSection: document.getElementById('auth-section'),
        mainContent: document.getElementById('main-content'),
        userInfo: document.getElementById('user-info'),
        usernameDisplay: document.getElementById('username-display'),
        logoutBtn: document.getElementById('logout-btn'),
        authTabs: document.querySelectorAll('.auth-tab'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginBtn: document.getElementById('login-btn'),
        registerBtn: document.getElementById('register-btn'),
        
        // Profile elements
        profileUsername: document.getElementById('profile-username'),
        profileEmail: document.getElementById('profile-email'),
        memberSinceDate: document.getElementById('member-since-date'),
        
        // Main app elements
        machineInput: document.getElementById('machine-input'),
        addMachineBtn: document.getElementById('add-machine'),
        machinesList: document.getElementById('machines-list'),
        machineCount: document.getElementById('machine-count'),
        workoutsGenerated: document.getElementById('workouts-generated'),
        currentStreak: document.getElementById('current-streak'),
        totalWorkoutTime: document.getElementById('total-workout-time'),
        splitTypeSelect: document.getElementById('split-type'),
        dayOverrideSelect: document.getElementById('day-override-select'),
        applyOverrideBtn: document.getElementById('apply-override'),
        generateWorkoutBtn: document.getElementById('generate-workout'),
        loading: document.getElementById('loading'),
        workoutDisplay: document.getElementById('workout-display'),
        
        // Other elements
        difficultyBtns: document.querySelectorAll('.difficulty-btn'),
        dayName: document.getElementById('day-name'),
        workoutFocus: document.getElementById('workout-focus'),
        
        // Export button
        exportDataBtn: document.getElementById('export-data')
    };
}

// Initialize the application
function init() {
    console.log('Initializing app...');
    
    // Initialize DOM elements first
    initElements();
    
    console.log('Elements check:', {
        authSection: elements.authSection,
        mainContent: elements.mainContent,
        userInfo: elements.userInfo
    });
    
    const currentUser = userManager.getCurrentUser();
    console.log('Current user from manager:', currentUser);
    
    if (currentUser) {
        showMainApp(currentUser);
    } else {
        showAuthSection();
    }
    
    setupEventListeners();
    console.log('App initialization completed');
}

// Show authentication section
function showAuthSection() {
    elements.authSection.style.display = 'block';
    elements.mainContent.style.display = 'none';
    elements.userInfo.style.display = 'none';
}

// Show main application
function showMainApp(user) {
    console.log('showMainApp called with user:', user);
    appState.currentUser = user;
    
    // Debug logging
    console.log('Auth section element:', elements.authSection);
    console.log('Main content element:', elements.mainContent);
    console.log('User info element:', elements.userInfo);
    
    elements.authSection.style.display = 'none';
    elements.mainContent.style.display = 'block';
    elements.userInfo.style.display = 'flex';
    
    // Update user info display
    if (elements.usernameDisplay) elements.usernameDisplay.textContent = user.username;
    if (elements.profileUsername) elements.profileUsername.textContent = user.username;
    if (elements.profileEmail) elements.profileEmail.textContent = user.email;
    if (elements.memberSinceDate) elements.memberSinceDate.textContent = user.joinDate;
    
    // Load user data
    loadUserData(user.data);
    updateCurrentDay();
    renderMachines();
    updateStats();
    
    console.log('showMainApp completed');
}

// Load user data into app state
function loadUserData(data) {
    elements.splitTypeSelect.value = data.splitType;
    elements.dayOverrideSelect.value = data.dayOverride;
    
    // Set difficulty
    elements.difficultyBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === data.difficulty);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Auth tab switching
    elements.authTabs.forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });
    
    // Auth form submissions
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.registerBtn.addEventListener('click', handleRegister);
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Main app events (only add listeners if elements exist)
    if (elements.addMachineBtn) {
        elements.addMachineBtn.addEventListener('click', addMachine);
    }
    if (elements.machineInput) {
        elements.machineInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addMachine();
        });
    }
    if (elements.splitTypeSelect) {
        elements.splitTypeSelect.addEventListener('change', updateSplit);
    }
    if (elements.applyOverrideBtn) {
        elements.applyOverrideBtn.addEventListener('click', applyDayOverride);
    }
    if (elements.generateWorkoutBtn) {
        elements.generateWorkoutBtn.addEventListener('click', generateWorkout);
    }
    
    // Difficulty selection
    elements.difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
    });
    
    // Export data control
    if (elements.exportDataBtn) {
        elements.exportDataBtn.addEventListener('click', exportData);
    }
}

// Auth functions
function switchAuthTab(tab) {
    elements.authTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    elements.loginForm.classList.toggle('hidden', tab !== 'login');
    elements.registerForm.classList.toggle('hidden', tab !== 'register');
}

function handleLogin() {
    console.log('handleLogin called');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('Login attempt:', username);
    
    try {
        const user = userManager.login(username, password);
        console.log('Login successful:', user);
        showMainApp(user);
        showNotification(`Welcome back, ${user.username}!`, 'success');
    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message, 'error');
    }
}

function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    try {
        const user = userManager.register(username, email, password, confirmPassword);
        const loginUser = userManager.login(username, password);
        showMainApp(loginUser);
        showNotification(`Account created successfully! Welcome, ${user.username}!`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function handleLogout() {
    userManager.logout();
    showAuthSection();
    showNotification('Logged out successfully!', 'info');
}

// User data functions
function saveUserData(key, value) {
    if (!appState.currentUser) return;
    
    const updateData = {};
    updateData[key] = value;
    userManager.updateUserData(updateData);
    appState.currentUser.data[key] = value;
}

function getUserData(key) {
    if (!appState.currentUser) return null;
    return appState.currentUser.data[key];
}

// Set workout difficulty
function setDifficulty(difficulty) {
    saveUserData('difficulty', difficulty);
    
    elements.difficultyBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
    });
}

// Apply day override
function applyDayOverride() {
    const dayOverride = elements.dayOverrideSelect.value;
    saveUserData('dayOverride', dayOverride);
    updateCurrentDay();
    showNotification('Day override applied!', 'success');
}

// Update stats display
function updateStats() {
    if (!appState.currentUser) return;
    
    const data = appState.currentUser.data;
    if (elements.machineCount) elements.machineCount.textContent = data.machines.length;
    if (elements.workoutsGenerated) elements.workoutsGenerated.textContent = data.workoutsGenerated;
    if (elements.currentStreak) elements.currentStreak.textContent = data.currentStreak;
    if (elements.totalWorkoutTime) elements.totalWorkoutTime.textContent = data.totalWorkoutTime.toFixed(1);
}

// Add machine
function addMachine() {
    const machineName = elements.machineInput.value.trim();
    const machines = getUserData('machines') || [];
    
    if (machineName && !machines.includes(machineName)) {
        machines.push(machineName);
        saveUserData('machines', machines);
        elements.machineInput.value = '';
        renderMachines();
        updateStats();
        showNotification(`${machineName} added!`, 'success');
    } else if (machines.includes(machineName)) {
        showNotification('Machine already exists!', 'error');
    }
}

// Remove machine
function removeMachine(machineName) {
    const machines = getUserData('machines') || [];
    const updatedMachines = machines.filter(machine => machine !== machineName);
    saveUserData('machines', updatedMachines);
    renderMachines();
    updateStats();
    showNotification(`${machineName} removed!`, 'success');
}

// Remove machine
function removeMachine(machineName) {
    appState.machines = appState.machines.filter(machine => machine !== machineName);
    localStorage.setItem('machines', JSON.stringify(appState.machines));
    renderMachines();
    updateStats();
    showNotification(`${machineName} removed!`, 'success');
}

// Render machines list
function renderMachines() {
    if (!elements.machinesList) return;
    
    elements.machinesList.innerHTML = '';
    const machines = getUserData('machines') || [];
    
    machines.forEach(machine => {
        const machineElement = document.createElement('div');
        machineElement.className = 'machine-item';
        machineElement.innerHTML = `
            <span class="machine-name">${machine}</span>
            <button class="btn btn-danger" onclick="removeMachine('${machine}')">Remove</button>
        `;
        elements.machinesList.appendChild(machineElement);
    });
}

// Update split type
function updateSplit() {
    const splitType = elements.splitTypeSelect.value;
    saveUserData('splitType', splitType);
    updateCurrentDay();
}

// Update current day and workout focus
function updateCurrentDay() {
    if (!appState.currentUser) return;
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[appState.currentDay];
    
    const data = appState.currentUser.data;
    let workoutType, workoutFocus;
    
    if (data.dayOverride !== 'auto') {
        // Use day override
        const override = dayOverrideMapping[data.dayOverride];
        workoutType = override.type;
        workoutFocus = override.focus;
    } else {
        // Use split configuration
        const config = splitConfigs[data.splitType];
        workoutType = config.pattern[appState.currentDay];
        workoutFocus = config.focuses[workoutType];
    }

    if (elements.dayName) elements.dayName.textContent = dayName;
    if (elements.workoutFocus) elements.workoutFocus.textContent = `${workoutType} - ${workoutFocus}`;
}

// Generate workout using Gemini API
async function generateWorkout() {
    const machines = getUserData('machines') || [];
    
    if (machines.length === 0) {
        showNotification('Please add some machines first', 'error');
        return;
    }

    elements.loading.style.display = 'block';
    elements.workoutDisplay.innerHTML = '';

    try {
        const data = appState.currentUser.data;
        let workoutType, workoutFocus;
        
        if (data.dayOverride !== 'auto') {
            const override = dayOverrideMapping[data.dayOverride];
            workoutType = override.type;
            workoutFocus = override.focus;
        } else {
            const config = splitConfigs[data.splitType];
            workoutType = config.pattern[appState.currentDay];
            workoutFocus = config.focuses[workoutType];
        }

        if (workoutType === 'Rest') {
            displayRestDay();
            elements.loading.style.display = 'none';
            return;
        }

        const prompt = createWorkoutPrompt(workoutType, workoutFocus, data.difficulty, machines);
        const workout = await callGeminiAPI(prompt);
        displayWorkout(workout, workoutType);
        
        // Update stats
        const newWorkoutCount = data.workoutsGenerated + 1;
        const today = new Date().toDateString();
        let newStreak = data.currentStreak;
        
        // Update streak logic
        if (data.lastWorkoutDate) {
            const lastDate = new Date(data.lastWorkoutDate);
            const todayDate = new Date();
            const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 1) {
                newStreak++;
            } else if (daysDiff > 1) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }
        
        saveUserData('workoutsGenerated', newWorkoutCount);
        saveUserData('currentStreak', newStreak);
        saveUserData('lastWorkoutDate', today);
        
        updateStats();
        
    } catch (error) {
        console.error('Error generating workout:', error);
        showNotification('Error generating workout. Please try again.', 'error');
    } finally {
        elements.loading.style.display = 'none';
    }
}

// Create workout prompt for Gemini API
function createWorkoutPrompt(workoutType, workoutFocus, difficulty, machines) {
    const machinesList = machines.join(', ');
    
    let difficultyInstructions = '';
    switch(difficulty) {
        case 'beginner':
            difficultyInstructions = 'Focus on proper form and lighter weights. Include 2-3 sets of 10-15 reps for most exercises. Include more rest time between sets.';
            break;
        case 'intermediate':
            difficultyInstructions = 'Balanced workout with 3-4 sets of 8-12 reps. Mix compound and isolation exercises.';
            break;
        case 'advanced':
            difficultyInstructions = 'Intense workout with 4-5 sets of 6-10 reps for strength, or higher volume for hypertrophy. Include advanced techniques like drop sets or supersets.';
            break;
    }
    
    // Advanced difficulty gets more exercises per muscle group
    const exerciseCount = difficulty === 'advanced' ? '8-10' : '5-6';
    const exerciseDetail = difficulty === 'advanced' ? 
        'Include 3-4 exercises per major muscle group being targeted. Use compound movements and isolation exercises.' : 
        'Mix compound and isolation exercises efficiently.';
    
    return `Create a concise ${difficulty} level workout plan for a ${workoutType} day focusing on ${workoutFocus}.

Available machines/equipment: ${machinesList}

Difficulty Level: ${difficulty.toUpperCase()}
${difficultyInstructions}

Please provide a CLEAN, ORGANIZED workout with:
1. A brief warm-up (2-3 exercises)
2. ${exerciseCount} main exercises using the available equipment
3. Sets x Reps for each exercise
4. A short cool-down (2-3 stretches)

${exerciseDetail}

Format as a simple list with clear headings. Keep descriptions brief and actionable. No long paragraphs or excessive explanations.`;
}

// Call Gemini API with hardcoded key
async function callGeminiAPI(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Invalid API response format');
    }
}

// Display generated workout
function displayWorkout(workoutText, workoutType) {
    elements.workoutDisplay.innerHTML = `
        <div class="workout-content">
            <h3>${workoutType} Workout - ${new Date().toLocaleDateString()}</h3>
            <div class="workout-text">${formatWorkoutText(workoutText)}</div>
        </div>
    `;
}

// Display rest day message
function displayRestDay() {
    elements.workoutDisplay.innerHTML = `
        <div class="workout-content">
            <h3>Rest Day - ${new Date().toLocaleDateString()}</h3>
            <div class="workout-text">
                <p>🛌 <strong>Today is your rest day!</strong></p>
                <p>Rest days are crucial for muscle recovery and growth. Consider:</p>
                <ul>
                    <li>Light stretching or yoga</li>
                    <li>Going for a walk</li>
                    <li>Foam rolling</li>
                    <li>Staying hydrated</li>
                    <li>Getting adequate sleep</li>
                </ul>
                <p>Come back tomorrow for your next workout! 💪</p>
            </div>
        </div>
    `;
}

// Format workout text for better display
function formatWorkoutText(text) {
    // Clean up the text and create a more structured format
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\d+\.\s(.+)/gm, '<div class="workout-section"><strong>$1</strong>')
        .replace(/^- (.+)/gm, '<div class="exercise-item">• $1</div>')
        .replace(/(\d+ sets? x \d+(-\d+)? reps?)/gi, '<span class="sets-reps">$1</span>')
        .replace(/\n\n+/g, '</div><br>')
        .replace(/\n/g, '<br>');
    
    // Ensure proper closing of workout sections
    formattedText = formattedText.replace(/(<div class="workout-section">.*?)(?=<div class="workout-section">|$)/gs, '$1</div>');
    
    return `<div class="formatted-workout">${formattedText}</div>`;
}

// Export user data
function exportData() {
    if (!appState.currentUser) return;
    
    const exportData = {
        user: {
            username: appState.currentUser.username,
            email: appState.currentUser.email,
            joinDate: appState.currentUser.joinDate
        },
        data: appState.currentUser.data,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `momentumx_data_${appState.currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully!', 'success');
}



// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
    `;

    // Enhanced notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 12px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        max-width: 400px;
        min-width: 300px;
        animation: slideIn 0.4s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        ${type === 'success' ? 'background: linear-gradient(135deg, #48bb78, #38a169);' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #e53e3e, #c53030);' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #4299e1, #3182ce);' : ''}
    `;

    notification.querySelector('button').style.cssText = `
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.3s ease;
    `;

    notification.querySelector('button').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.3)';
    });

    notification.querySelector('button').addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255,255,255,0.2)';
    });

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.4s ease';
            setTimeout(() => notification.remove(), 400);
        }
    }, 5000);
}

// Add enhanced CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%) translateY(-10px);
            opacity: 0;
        }
        to {
            transform: translateX(0) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%) translateY(-10px);
            opacity: 0;
        }
    }
    
    /* Scrollbar styling for dark theme */
    ::-webkit-scrollbar {
        width: 8px;
    }
    
    ::-webkit-scrollbar-track {
        background: rgba(45, 55, 72, 0.4);
        border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
        background: rgba(102, 126, 234, 0.6);
        border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
        background: rgba(102, 126, 234, 0.8);
    }
`;
document.head.appendChild(style);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
