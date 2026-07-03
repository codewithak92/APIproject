const API_URL = 'http://localhost:8000/api/v1';

// --- State Management ---
let state = {
    token: localStorage.getItem('token') || null,
    user: null, // we will just store role in localStorage or decode from token, but backend doesn't have a /me route. We'll decode JWT.
    tasks: []
};

// --- Utilities ---
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch(e) {
        return null;
    }
}

if (state.token) {
    state.user = parseJwt(state.token);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- API Client ---
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            logout();
            return null;
        }
        
        if (response.status === 204) return true;
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'An error occurred');
        }
        
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// --- Views ---
const app = document.getElementById('app');

function renderLogin() {
    app.innerHTML = `
        <div class="auth-container glass">
            <div class="auth-header">
                <i class="ph ph-lock-key"></i>
                <h2>Welcome Back</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">Login to manage your tasks</p>
            </div>
            <form id="login-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required placeholder="name@example.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    <i class="ph ph-sign-in"></i> Sign In
                </button>
            </form>
            <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem;">
                Don't have an account? <a href="#" id="go-to-register" style="color: var(--accent);">Register</a>
            </p>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            // OAuth2 requires form-urlencoded
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.detail);

            state.token = data.access_token;
            state.user = parseJwt(data.access_token);
            localStorage.setItem('token', data.access_token);
            
            showToast('Logged in successfully!');
            renderDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    document.getElementById('go-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        renderRegister();
    });
}

function renderRegister() {
    app.innerHTML = `
        <div class="auth-container glass">
            <div class="auth-header">
                <i class="ph ph-user-plus"></i>
                <h2>Create Account</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">Sign up to get started</p>
            </div>
            <form id="register-form">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="reg-email" required placeholder="name@example.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="reg-password" required placeholder="••••••••">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="reg-role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    <i class="ph ph-user-circle-plus"></i> Register
                </button>
            </form>
            <p style="text-align: center; margin-top: 1.5rem; font-size: 0.9rem;">
                Already have an account? <a href="#" id="go-to-login" style="color: var(--accent);">Login</a>
            </p>
        </div>
    `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role').value;
        
        try {
            await apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, role })
            });
            showToast('Registered successfully! Please log in.');
            renderLogin();
        } catch (err) {}
    });

    document.getElementById('go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        renderLogin();
    });
}

async function renderDashboard() {
    app.innerHTML = `
        <div class="container">
            <header class="dashboard-header glass" style="padding: 1rem 2rem; border-radius: var(--radius-lg);">
                <div>
                    <h2>Task Manager Pro</h2>
                    <p style="font-size: 0.875rem; color: var(--text-secondary);">Welcome, ${state.user.email} (${state.user.role})</p>
                </div>
                <div class="nav-links">
                    <button id="add-task-btn" class="btn btn-primary btn-small">
                        <i class="ph ph-plus"></i> New Task
                    </button>
                    ${state.user.role === 'admin' ? '<a id="admin-view-btn"><i class="ph ph-shield"></i> All Tasks</a>' : ''}
                    <a id="logout-btn"><i class="ph ph-sign-out"></i> Logout</a>
                </div>
            </header>

            <div class="tasks-grid" id="tasks-container">
                <!-- Tasks loaded here -->
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem;">
                    <i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i>
                    <p>Loading tasks...</p>
                </div>
            </div>
        </div>

        <!-- Task Modal -->
        <div class="modal-overlay" id="task-modal">
            <div class="modal glass">
                <div class="modal-header">
                    <h3 id="modal-title">Create Task</h3>
                    <button class="close-btn" id="close-modal"><i class="ph ph-x"></i></button>
                </div>
                <form id="task-form">
                    <input type="hidden" id="task-id">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="task-title-input" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="task-desc-input" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="task-status-input">
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Save Task</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('add-task-btn').addEventListener('click', () => openTaskModal());
    document.getElementById('close-modal').addEventListener('click', closeTaskModal);
    
    if (document.getElementById('admin-view-btn')) {
        document.getElementById('admin-view-btn').addEventListener('click', fetchAdminTasks);
    }

    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);

    await fetchTasks();
}

async function fetchTasks() {
    try {
        state.tasks = await apiCall('/tasks');
        renderTasksGrid();
    } catch (err) {}
}

async function fetchAdminTasks() {
    try {
        state.tasks = await apiCall('/admin/tasks');
        renderTasksGrid('All Users Tasks (Admin View)');
    } catch (err) {}
}

function renderTasksGrid(title = 'Your Tasks') {
    const container = document.getElementById('tasks-container');
    if (state.tasks.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem; background: var(--glass-bg); border-radius: var(--radius-lg); border: 1px dashed var(--border);">
                <i class="ph ph-empty" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No tasks found. Create one to get started!</p>
            </div>
        `;
        return;
    }

    let html = `<div style="grid-column: 1/-1; margin-bottom: -1rem;"><h3 style="color: var(--text-secondary); font-size: 1rem;">${title}</h3></div>`;
    
    state.tasks.forEach(task => {
        html += `
            <div class="task-card glass">
                <div class="task-header">
                    <h3 class="task-title">${task.title}</h3>
                    <span class="task-status status-${task.status}">${task.status.replace('-', ' ')}</span>
                </div>
                <p class="task-desc">${task.description || '<em style="opacity: 0.5">No description</em>'}</p>
                <div class="task-actions">
                    <button class="btn btn-small glass" onclick="editTask(${task.id})"><i class="ph ph-pencil-simple"></i> Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteTask(${task.id})"><i class="ph ph-trash"></i> Delete</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    renderLogin();
}

// Modal Logic
function openTaskModal(task = null) {
    const modal = document.getElementById('task-modal');
    document.getElementById('modal-title').textContent = task ? 'Edit Task' : 'Create Task';
    document.getElementById('task-id').value = task ? task.id : '';
    document.getElementById('task-title-input').value = task ? task.title : '';
    document.getElementById('task-desc-input').value = task ? (task.description || '') : '';
    document.getElementById('task-status-input').value = task ? task.status : 'pending';
    
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title-input').value;
    const description = document.getElementById('task-desc-input').value;
    const status = document.getElementById('task-status-input').value;

    const payload = { title, description, status };

    try {
        if (id) {
            await apiCall(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            showToast('Task updated');
        } else {
            await apiCall('/tasks', { method: 'POST', body: JSON.stringify(payload) });
            showToast('Task created');
        }
        closeTaskModal();
        fetchTasks();
    } catch (err) {}
}

window.editTask = (id) => {
    const task = state.tasks.find(t => t.id === id);
    if (task) openTaskModal(task);
};

window.deleteTask = async (id) => {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await apiCall(`/tasks/${id}`, { method: 'DELETE' });
            showToast('Task deleted');
            fetchTasks();
        } catch(err) {}
    }
};

// Initialize app
function init() {
    if (state.token && state.user) {
        renderDashboard();
    } else {
        renderLogin();
    }
}

init();
