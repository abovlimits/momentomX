// Hardcoded API key (provided by user)
const GEMINI_API_KEY = 'AIzaSyAtWkG0LoxtA9lrtvqenkwuxCyzhzvkHzc';

// Simple API client for backend integration
const apiClient = {
    token: localStorage.getItem('mx_auth_token') || null,
    setToken(t) {
        this.token = t;
        if (t) localStorage.setItem('mx_auth_token', t);
        else localStorage.removeItem('mx_auth_token');
    },
    headers(json = true) {
        const h = {};
        if (json) h['Content-Type'] = 'application/json';
        if (this.token) h['Authorization'] = `Bearer ${this.token}`;
        return h;
    },
    async get(path) {
        const res = await fetch(`/api${path}`, { headers: this.headers(false) });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },
    async post(path, body) {
        const res = await fetch(`/api${path}`, { method: 'POST', headers: this.headers(true), body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },
    async put(path, body) {
        const res = await fetch(`/api${path}`, { method: 'PUT', headers: this.headers(true), body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    },
    async del(path) {
        const res = await fetch(`/api${path}`, { method: 'DELETE', headers: this.headers(false) });
        if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
        return res.json();
    }
};

// User Authentication & Data Management
class UserManager {
    constructor() {
        this.currentUser = null;
        this.demoUser = {
            username: 'demo',
            password: 'demo123',
            email: 'demo@momentumx.app',
            joinDate: '2025-01-01'
        };
    }

    async ensureUserProfileLoaded() {
        if (this.currentUser) return this.currentUser;
        const savedUser = localStorage.getItem('momentumx_currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            return this.currentUser;
        }
        if (!apiClient.token) return null;
        try {
            const profile = await apiClient.get('/user/profile');
            const machines = await apiClient.get('/user/machines');
            this.currentUser = {
                id: profile.id,
                username: profile.username,
                email: profile.email,
                joinDate: profile.join_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                data: {
                    machines: (machines || []).map(m => m.machine_name),
                    splitType: profile.split_type || 'upper-lower',
                    difficulty: profile.difficulty_level || 'intermediate',
                    dayOverride: profile.day_override || 'auto',
                    repsStyle: profile.reps_style || 'auto',
                    repsMin: profile.reps_min ?? 8,
                    repsMax: profile.reps_max ?? 12,
                    exercisesPerMuscle: profile.exercises_per_muscle || 'auto',
                    setsPerExercise: profile.sets_per_exercise || 'auto',
                    restSeconds: profile.rest_seconds || 'auto',
                    includeBodyweight: profile.include_bodyweight ?? true,
                    focusedMuscle: profile.focused_muscle || 'none',
                    workoutsGenerated: profile.total_workouts || 0,
                    currentStreak: profile.current_streak_days || 0,
                    lastWorkoutDate: profile.last_workout_date || null,
                    totalWorkoutTime: profile.total_workout_time_minutes || 0
                }
            };
            localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));
            return this.currentUser;
        } catch (e) {
            console.warn('Failed to load profile from server:', e.message);
            return null;
        }
    }

    register(username, email, password, confirmPassword) {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (username.length < 3) throw new Error('Username must be at least 3 characters');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        // Register via backend
        return apiClient.post('/auth/register', { username, email, password }).then(async (res) => {
            apiClient.setToken(res.token);
            try {
                // hydrate current user from profile endpoint
                const profile = await apiClient.get('/user/profile');
                const machines = await apiClient.get('/user/machines');
                this.currentUser = {
                    id: profile.id,
                    username: profile.username,
                    email: profile.email,
                    joinDate: profile.join_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    data: {
                        machines: (machines || []).map(m => m.machine_name),
                        splitType: profile.split_type || 'upper-lower',
                        difficulty: profile.difficulty_level || 'intermediate',
                        dayOverride: profile.day_override || 'auto',
                        repsStyle: profile.reps_style || 'auto',
                        repsMin: profile.reps_min ?? 8,
                        repsMax: profile.reps_max ?? 12,
                        exercisesPerMuscle: profile.exercises_per_muscle || 'auto',
                        setsPerExercise: profile.sets_per_exercise || 'auto',
                        restSeconds: profile.rest_seconds || 'auto',
                        includeBodyweight: profile.include_bodyweight ?? true,
                        workoutsGenerated: profile.total_workouts || 0,
                        currentStreak: profile.current_streak_days || 0,
                        lastWorkoutDate: profile.last_workout_date || null,
                        totalWorkoutTime: profile.total_workout_time_minutes || 0
                    }
                };
            } catch (e) {
                console.warn('Profile fetch failed after register; using defaults:', e.message);
                this.currentUser = {
                    id: res.user?.id || 0,
                    username: res.user?.username || username,
                    email: res.user?.email || email,
                    joinDate: new Date().toISOString().split('T')[0],
                    data: this.getDefaultUserData()
                };
            }
            localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));
            return this.currentUser;
        });
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
        return apiClient.post('/auth/login', { username, password }).then(async (res) => {
            apiClient.setToken(res.token);
            try {
                const profile = await apiClient.get('/user/profile');
                const machines = await apiClient.get('/user/machines');
                this.currentUser = {
                    id: profile.id,
                    username: profile.username,
                    email: profile.email,
                    joinDate: profile.join_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                    data: {
                        machines: (machines || []).map(m => m.machine_name),
                        splitType: profile.split_type || 'upper-lower',
                        difficulty: profile.difficulty_level || 'intermediate',
                        dayOverride: profile.day_override || 'auto',
                        repsStyle: profile.reps_style || 'auto',
                        repsMin: profile.reps_min ?? 8,
                        repsMax: profile.reps_max ?? 12,
                        exercisesPerMuscle: profile.exercises_per_muscle || 'auto',
                        setsPerExercise: profile.sets_per_exercise || 'auto',
                        restSeconds: profile.rest_seconds || 'auto',
                        includeBodyweight: profile.include_bodyweight ?? true,
                        focusedMuscle: profile.focused_muscle || 'none',
                        workoutsGenerated: profile.total_workouts || 0,
                        currentStreak: profile.current_streak_days || 0,
                        lastWorkoutDate: profile.last_workout_date || null,
                        totalWorkoutTime: profile.total_workout_time_minutes || 0
                    }
                };
            } catch (e) {
                console.warn('Profile fetch failed after login; using defaults:', e.message);
                this.currentUser = {
                    id: res.user?.id || 0,
                    username: res.user?.username || username,
                    email: res.user?.email || '',
                    joinDate: new Date().toISOString().split('T')[0],
                    data: this.getDefaultUserData()
                };
            }
            localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));
            return this.currentUser;
        });
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('momentumx_currentUser');
        apiClient.setToken(null);
    }

    getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        const savedUser = localStorage.getItem('momentumx_currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            return this.currentUser;
        }
        return null;
    }

    updateUserData(data) {
        if (!this.currentUser) return;
        // Always update local cache
        this.currentUser.data = { ...this.currentUser.data, ...data };
        localStorage.setItem('momentumx_currentUser', JSON.stringify(this.currentUser));

        // Demo user: local only
        if (this.currentUser.username === 'demo') return;

    // Map preference keys to backend
        const prefPayload = {};
        if (Object.prototype.hasOwnProperty.call(data, 'splitType')) prefPayload.split_type = data.splitType;
        if (Object.prototype.hasOwnProperty.call(data, 'difficulty')) prefPayload.difficulty_level = data.difficulty;
        if (Object.prototype.hasOwnProperty.call(data, 'dayOverride')) prefPayload.day_override = data.dayOverride;
    if (Object.prototype.hasOwnProperty.call(data, 'repsStyle')) prefPayload.reps_style = data.repsStyle;
    if (Object.prototype.hasOwnProperty.call(data, 'repsMin')) prefPayload.reps_min = data.repsMin;
    if (Object.prototype.hasOwnProperty.call(data, 'repsMax')) prefPayload.reps_max = data.repsMax;
    if (Object.prototype.hasOwnProperty.call(data, 'exercisesPerMuscle')) prefPayload.exercises_per_muscle = data.exercisesPerMuscle;
    if (Object.prototype.hasOwnProperty.call(data, 'setsPerExercise')) prefPayload.sets_per_exercise = data.setsPerExercise;
    if (Object.prototype.hasOwnProperty.call(data, 'restSeconds')) prefPayload.rest_seconds = data.restSeconds;
    if (Object.prototype.hasOwnProperty.call(data, 'includeBodyweight')) prefPayload.include_bodyweight = data.includeBodyweight ? 1 : 0;
    if (Object.prototype.hasOwnProperty.call(data, 'focusedMuscle')) prefPayload.focused_muscle = data.focusedMuscle;

        // Stats mapping
        const statsPayload = {};
        if (Object.prototype.hasOwnProperty.call(data, 'currentStreak')) statsPayload.current_streak_days = data.currentStreak;
        if (Object.prototype.hasOwnProperty.call(data, 'lastWorkoutDate')) statsPayload.last_workout_date = data.lastWorkoutDate;

        // Fire-and-forget updates to backend
        (async () => {
            try {
                if (Object.keys(prefPayload).length) await apiClient.put('/user/preferences', prefPayload);
                if (Object.keys(statsPayload).length) await apiClient.put('/user/stats', statsPayload);
                // Machines syncing if provided as full list
                if (Object.prototype.hasOwnProperty.call(data, 'machines')) {
                    const serverMachines = await apiClient.get('/user/machines');
                    const serverNames = new Set(serverMachines.map(m => m.machine_name));
                    const desired = new Set(data.machines);
                    // Add missing
                    for (const name of desired) {
                        if (!serverNames.has(name)) {
                            await apiClient.post('/user/machines', { machine_name: name });
                        }
                    }
                    // Remove extras
                    for (const m of serverMachines) {
                        if (!desired.has(m.machine_name)) {
                            await apiClient.del(`/user/machines/${m.id}`);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to sync user data to server:', e.message);
            }
        })();
    }

    saveUsersToFile() {
        // No-op: previously downloaded a JSON file. Persisting to server now.
    }

    getDefaultUserData() {
        return {
            machines: [],
            splitType: 'upper-lower',
            difficulty: 'intermediate',
            dayOverride: 'auto',
            repsStyle: 'auto',
            repsMin: 8,
            repsMax: 12,
            exercisesPerMuscle: 'auto',
            setsPerExercise: 'auto',
            restSeconds: 'auto',
            includeBodyweight: true,
            focusedMuscle: 'none',
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
        exportDataBtn: document.getElementById('export-data'),

        // Reps range controls
        repsStyle: document.getElementById('reps-style'),
        repsCustomWrap: document.getElementById('reps-custom'),
        repsMin: document.getElementById('reps-min'),
        repsMax: document.getElementById('reps-max'),

        // Extra workout prefs
        exercisesPerMuscle: document.getElementById('exercises-per-muscle'),
        setsPerExercise: document.getElementById('sets-per-exercise'),
        restSeconds: document.getElementById('rest-seconds'),
        includeBodyweight: document.getElementById('include-bodyweight'),
        focusedMuscle: document.getElementById('focused-muscle')
    };
}

// Initialize the application
async function init() {
    console.log('Initializing app...');
    
    // Initialize DOM elements first
    initElements();
    
    console.log('Elements check:', {
        authSection: elements.authSection,
        mainContent: elements.mainContent,
        userInfo: elements.userInfo
    });
    
    let currentUser = userManager.getCurrentUser();
    console.log('Current user from manager:', currentUser);
    // If token exists but no current user object, try loading from server
    if (!currentUser && apiClient.token) {
        currentUser = await userManager.ensureUserProfileLoaded();
    }

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

    // Reps UI
    const style = data.repsStyle || 'auto';
    if (elements.repsStyle) elements.repsStyle.value = style;
    const useCustom = style === 'custom';
    if (elements.repsCustomWrap) elements.repsCustomWrap.style.display = useCustom ? 'flex' : 'none';
    if (useCustom) {
        if (elements.repsMin) elements.repsMin.value = data.repsMin ?? 8;
        if (elements.repsMax) elements.repsMax.value = data.repsMax ?? 12;
    }

    // Extra workout prefs
    if (elements.exercisesPerMuscle) elements.exercisesPerMuscle.value = data.exercisesPerMuscle || 'auto';
    if (elements.setsPerExercise) elements.setsPerExercise.value = data.setsPerExercise || 'auto';
    if (elements.restSeconds) elements.restSeconds.value = data.restSeconds || 'auto';
    if (elements.includeBodyweight) elements.includeBodyweight.checked = !!data.includeBodyweight;
    if (elements.focusedMuscle) elements.focusedMuscle.value = data.focusedMuscle || 'none';
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
    // Reps style change handlers
    if (elements.repsStyle) {
        elements.repsStyle.addEventListener('change', () => {
            const style = elements.repsStyle.value;
            const isCustom = style === 'custom';
            if (elements.repsCustomWrap) elements.repsCustomWrap.style.display = isCustom ? 'flex' : 'none';
            saveUserData('repsStyle', style);
        });
    }
    if (elements.repsMin) {
        elements.repsMin.addEventListener('change', () => {
            const min = Math.max(1, Math.min(30, parseInt(elements.repsMin.value || '8')));
            saveUserData('repsMin', min);
        });
    }
    if (elements.repsMax) {
        elements.repsMax.addEventListener('change', () => {
            const max = Math.max(1, Math.min(30, parseInt(elements.repsMax.value || '12')));
            saveUserData('repsMax', max);
        });
    }
    if (elements.exercisesPerMuscle) {
        elements.exercisesPerMuscle.addEventListener('change', () => {
            const v = elements.exercisesPerMuscle.value;
            saveUserData('exercisesPerMuscle', v);
        });
    }
    if (elements.setsPerExercise) {
        elements.setsPerExercise.addEventListener('change', () => {
            const v = elements.setsPerExercise.value;
            saveUserData('setsPerExercise', v);
        });
    }
    if (elements.restSeconds) {
        elements.restSeconds.addEventListener('change', () => {
            const v = elements.restSeconds.value;
            saveUserData('restSeconds', v);
        });
    }
    if (elements.includeBodyweight) {
        elements.includeBodyweight.addEventListener('change', () => {
            saveUserData('includeBodyweight', elements.includeBodyweight.checked);
        });
    }
    if (elements.focusedMuscle) {
        elements.focusedMuscle.addEventListener('change', () => {
            const v = elements.focusedMuscle.value;
            saveUserData('focusedMuscle', v);
        });
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

async function handleLogin() {
    console.log('handleLogin called');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('Login attempt:', username);
    
    try {
        const user = await userManager.login(username, password);
        console.log('Login successful:', user);
        showMainApp(user);
        showNotification(`Welcome back, ${user.username}!`, 'success');
    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message, 'error');
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    try {
        const user = await userManager.register(username, email, password, confirmPassword);
        showMainApp(user);
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
async function addMachine() {
    const machineName = elements.machineInput.value.trim();
    const machines = getUserData('machines') || [];
    
    if (machineName && !machines.includes(machineName)) {
        machines.push(machineName);
        saveUserData('machines', machines);
        elements.machineInput.value = '';
        renderMachines();
        updateStats();
        // Sync to backend
        try {
            if (appState.currentUser.username !== 'demo') {
                await apiClient.post('/user/machines', { machine_name: machineName });
            }
        } catch (e) {
            console.error('Failed to add machine on server:', e.message);
        }
        showNotification(`${machineName} added!`, 'success');
    } else if (machines.includes(machineName)) {
        showNotification('Machine already exists!', 'error');
    }
}

// Remove machine
async function removeMachine(machineName) {
    const machines = getUserData('machines') || [];
    const updatedMachines = machines.filter(machine => machine !== machineName);
    saveUserData('machines', updatedMachines);
    renderMachines();
    updateStats();
    // Sync to backend
    try {
        if (appState.currentUser.username !== 'demo') {
            const serverMachines = await apiClient.get('/user/machines');
            const match = serverMachines.find(m => m.machine_name === machineName);
            if (match) await apiClient.del(`/user/machines/${match.id}`);
        }
    } catch (e) {
        console.error('Failed to remove machine on server:', e.message);
    }
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
        // Persist workout to server (optional content text)
        try {
            if (appState.currentUser.username !== 'demo') {
                const todayISO = new Date().toISOString().split('T')[0];
                await apiClient.post('/workouts', {
                    workout_type: workoutType,
                    workout_date: todayISO,
                    difficulty_level: data.difficulty,
                    split_type: data.splitType,
                    workout_content: workout,
                    duration_minutes: null,
                    calories_burned: null
                });
            }
        } catch (e) {
            console.warn('Failed to save workout on server:', e.message);
        }
        
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
    
    // Reps style guidance
    const { repsStyle = 'auto', repsMin = 8, repsMax = 12 } = appState.currentUser?.data || {};
    let repsGuidance = '';
    switch (repsStyle) {
        case 'strength': repsGuidance = 'Use 3–5 reps per set focused on strength.'; break;
        case 'power': repsGuidance = 'Use 6–8 reps per set for power/hypertrophy.'; break;
        case 'hypertrophy': repsGuidance = 'Use 8–12 reps per set for hypertrophy.'; break;
        case 'endurance': repsGuidance = 'Use 12–15 reps per set for muscular endurance.'; break;
        case 'custom': repsGuidance = `Use ${repsMin}–${repsMax} reps per set across main exercises.`; break;
        case 'auto': default: repsGuidance = 'Choose reps appropriate for the difficulty level.'; break;
    }

    // Advanced difficulty gets more exercises per muscle group
    const exerciseCount = difficulty === 'advanced' ? '8-10' : '5-6';
    const exerciseDetail = difficulty === 'advanced' ? 
        'Include 3-4 exercises per major muscle group being targeted. Use compound movements and isolation exercises.' : 
        'Mix compound and isolation exercises efficiently.';

    // Additional guidance based on preferences
    const d = appState.currentUser?.data || {};
    const muscleExercisesText = d.exercisesPerMuscle && d.exercisesPerMuscle !== 'auto' ? `Aim for ${d.exercisesPerMuscle} exercises per primary muscle group.` : '';
    const setsText = d.setsPerExercise && d.setsPerExercise !== 'auto' ? `Use ${d.setsPerExercise} sets per exercise.` : '';
    const restText = d.restSeconds && d.restSeconds !== 'auto' ? `Rest ${d.restSeconds} seconds between sets.` : '';
    const bodyweightText = d.includeBodyweight ? 'You may include bodyweight movements where appropriate.' : 'Prefer equipment-based movements over bodyweight.';
    const focusText = d.focusedMuscle && d.focusedMuscle !== 'none' ? `Prioritize exercises that emphasize the ${d.focusedMuscle} today.` : '';
    
    return `Create a concise ${difficulty} level workout plan for a ${workoutType} day focusing on ${workoutFocus}.

Available machines/equipment: ${machinesList}

Difficulty Level: ${difficulty.toUpperCase()}
${difficultyInstructions}

Please provide a CLEAN, ORGANIZED workout with:
1. A brief warm-up (2-3 exercises)
2. ${exerciseCount} main exercises using the available equipment
3. Sets x Reps for each exercise. ${repsGuidance}
4. A short cool-down (2-3 stretches)

${exerciseDetail}

${[muscleExercisesText, setsText, restText, bodyweightText, focusText].filter(Boolean).join(' ')}

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
    const dateStr = new Date().toLocaleDateString();
    const meta = {
        workoutType,
        dateStr,
        difficulty: appState.currentUser?.data?.difficulty || 'intermediate',
        splitType: appState.currentUser?.data?.splitType || 'upper-lower',
        restSeconds: appState.currentUser?.data?.restSeconds || 'auto',
        repsStyle: appState.currentUser?.data?.repsStyle || 'auto'
    };

    // Try structured parse first
    const blocks = parseWorkoutText(workoutText);
    const hasStructure = blocks.reduce((n, b) => n + (b.items?.length || 0), 0) >= 3 || blocks.length >= 2;
    const inner = hasStructure ? buildWorkoutHTML(blocks, meta) : `
        <h3>${workoutType} Workout - ${dateStr}</h3>
        <div class="workout-text">${formatWorkoutText(workoutText)}</div>
    `;

    elements.workoutDisplay.innerHTML = `
        <div class="workout-content">
            ${inner}
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

// --- Structured workout rendering ---
function parseWorkoutText(text) {
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
    const blocks = [];
    let current = null;

    const sectionRegex = /^(?:(?:\d+\.)|[-*•])?\s*(warm\s*-?\s*up|warmup|main(?:\s*(?:workout|lifts))?|workout|cool\s*-?\s*down|cooldown|finisher|accessor(?:y|ies)|stretch(?:es)?)/i;
    const bulletRegex = /^[-*•]\s*(.+)$/;

    function startBlock(title) {
        const t = normalizeTitle(title);
        current = { title: t, items: [] };
        blocks.push(current);
    }
    function normalizeTitle(raw) {
        const r = (raw || '').toLowerCase();
        if (r.includes('warm')) return 'Warm-up';
        if (r.includes('cool')) return 'Cool-down';
        if (r.includes('finish')) return 'Finisher';
        if (r.includes('accessor')) return 'Accessories';
        if (r.includes('stretch')) return 'Stretches';
        if (r.includes('main')) return 'Main';
        if (r.includes('workout')) return 'Workout';
        return raw.replace(/\*|#/g, '').trim().replace(/\b\w/g, c => c.toUpperCase()) || 'Workout';
    }

    for (let raw of lines) {
        // Bold headings like **Warm Up**
        const boldMatch = raw.match(/^\*\*(.+)\*\*$/);
        if (boldMatch && sectionRegex.test(boldMatch[1])) {
            startBlock(boldMatch[1]);
            continue;
        }

        // Numeric or keyword section
        const secMatch = raw.match(sectionRegex);
        if (secMatch && (raw.endsWith(':') || raw.endsWith('.') || raw.toLowerCase() === secMatch[0].toLowerCase())) {
            startBlock(secMatch[1]);
            continue;
        }

        // Italic-only headings like *Workout*
        const italicMatch = raw.match(/^\*(.+)\*$/);
        if (italicMatch && sectionRegex.test(italicMatch[1])) {
            startBlock(italicMatch[1]);
            continue;
        }

        // Exercise bullet or plain line with sets x reps pattern
        let line = raw;
        const bullet = raw.match(bulletRegex);
        if (bullet) line = bullet[1];

        const item = parseExerciseLine(line);
        if (item) {
            if (!current) startBlock('Workout');
            current.items.push(item);
            continue;
        }
        // Otherwise, treat as note under current block
        if (!current) startBlock('Workout');
        if (current && line) {
            current.items.push({ name: line });
        }
    }
    return blocks.length ? blocks : [{ title: 'Workout', items: [] }];
}

function parseExerciseLine(line) {
    if (!line) return null;
    // Extract parentheses notes first
    let notes = '';
    const paren = line.match(/\(([^)]+)\)/);
    if (paren) {
        notes = paren[1];
        line = line.replace(paren[0], '').trim();
    }
    // Sets x reps pattern
    const sr = line.match(/(\d+)\s*sets?\s*[x×]\s*(\d+(?:-\d+)?)\s*reps?/i);
    // Alternative compact like 3x10 or 4×8-10
    const compact = line.match(/(\d+)\s*[x×]\s*(\d+(?:-\d+)?)(?!\S)/i);
    let setsReps = '';
    if (sr) setsReps = `${sr[1]}x${sr[2]}`;
    else if (compact) setsReps = `${compact[1]}x${compact[2]}`;

    // Rest detection
    const rest = (() => {
        const m = line.match(/rest\s*[:\-]?\s*(\d+)\s*(sec|secs|seconds|s|min|mins|minutes|m)/i);
        if (!m) return '';
        const n = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const secs = unit.startsWith('m') ? `${n}m` : `${n}s`;
        return secs;
    })();

    // Bodyweight tag
    const bw = /\b(bodyweight|bw)\b/i.test(line);
    // Tempo
    const tempoMatch = line.match(/tempo\s*[:\-]?\s*([0-9xX\-]+)/i);
    const tempo = tempoMatch ? tempoMatch[1] : '';

    // Name: remove obvious decorators (after hyphen if preceding details)
    let name = line
        .replace(/\brest\b.*$/i, '')
        .replace(/\btempo\b.*$/i, '')
        .replace(/\b\d+\s*sets?\s*[x×]\s*\d+(?:-\d+)?\s*reps?\b/i, '')
        .replace(/\b\d+\s*[x×]\s*\d+(?:-\d+)?\b/i, '')
        .replace(/[-–—]\s*$/, '')
        .trim();

    // If nothing meaningful left, bail
    if (!name && !setsReps && !rest && !notes) return null;

    const tags = [];
    if (setsReps) tags.push({ type: 'sets', text: setsReps.replace(/-/g, '–') });
    if (rest) tags.push({ type: 'rest', text: rest });
    if (tempo) tags.push({ type: 'tempo', text: tempo });
    if (bw) tags.push({ type: 'bw', text: 'BW' });

    return { name: name || undefined, setsReps, rest, tempo, tags, notes };
}

function buildWorkoutHTML(blocks, meta) {
    const chips = [];
    chips.push(`<span class="meta-chip"><em>Type</em>${escapeHtml(meta.workoutType)}</span>`);
    chips.push(`<span class="meta-chip"><em>Difficulty</em>${escapeHtml(meta.difficulty)}</span>`);
    chips.push(`<span class="meta-chip"><em>Split</em>${escapeHtml(meta.splitType)}</span>`);
    if (meta.repsStyle && meta.repsStyle !== 'auto') chips.push(`<span class="meta-chip"><em>Reps</em>${escapeHtml(meta.repsStyle)}</span>`);
    if (meta.restSeconds && meta.restSeconds !== 'auto') chips.push(`<span class="meta-chip"><em>Rest</em>${escapeHtml(String(meta.restSeconds))}s</span>`);

    const blockHtml = blocks.map(b => {
        const rows = (b.items || []).map(it => {
            // If bare note row
            if (!it.name && (it.notes || '').length) {
                return `<div class="row-notes">${escapeHtml(it.notes)}</div>`;
            }
            const tags = (it.tags || []).map(t => `<span class="tag tag--${t.type}">${escapeHtml(t.text)}</span>`).join('');
            const notes = it.notes ? `<div class="row-notes">${escapeHtml(it.notes)}</div>` : '';
            return `
                <div class="workout-row">
                    <div class="row-name">${escapeHtml(it.name || '')}</div>
                    <div class="row-tags">${tags}</div>
                </div>
                ${notes}
            `;
        }).join('');
        return `
            <div class="workout-block">
                <div class="block-title">${escapeHtml(b.title)}</div>
                <div class="workout-rows">${rows}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="workout-header">
            <h3>${escapeHtml(meta.workoutType)} Workout - ${escapeHtml(meta.dateStr)}</h3>
            <div class="workout-meta">${chips.join('')}</div>
        </div>
        ${blockHtml}
    `;
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
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
