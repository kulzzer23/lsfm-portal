import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseUrl, supabaseKey, TABLES } from './config.js';

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin password
const ADMIN_PASSWORD = 'kulzz';

// State
const state = {
    isAuthenticated: false,
    currentTab: 'programs',
    programs: [],
    broadcasts: [],
    authors: [],
    learningContent: [],
    currentEditor: null
};

// Check authentication
function checkAuth() {
    const isAuth = sessionStorage.getItem('lsfm_admin_auth') === 'true';
    if (!isAuth) {
        showLoginModal();
        return false;
    }
    state.isAuthenticated = true;
    return true;
}

// Login Modal
function showLoginModal() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
        <div class="admin-modal" style="max-width: 400px;">
            <div class="admin-modal-header">
                <h2>Вход в админ-панель</h2>
            </div>
            <div class="admin-modal-body">
                <div class="form-group">
                    <label for="adminPasswordInput">Пароль администратора:</label>
                    <input type="password" id="adminPasswordInput" placeholder="Введите пароль" style="width: 100%;">
                </div>
            </div>
            <div class="admin-modal-footer">
                <button class="btn-primary" id="adminLoginBtn">Войти</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const passwordInput = overlay.querySelector('#adminPasswordInput');
    const loginBtn = overlay.querySelector('#adminLoginBtn');
    
    loginBtn.addEventListener('click', () => {
        if (passwordInput.value === ADMIN_PASSWORD) {
            sessionStorage.setItem('lsfm_admin_auth', 'true');
            state.isAuthenticated = true;
            overlay.remove();
            init();
        } else {
            alert('Неверный пароль!');
            passwordInput.value = '';
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });
    
    setTimeout(() => passwordInput.focus(), 100);
}

// Logout
document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
    if (confirm('Выйти из админ-панели?')) {
        sessionStorage.removeItem('lsfm_admin_auth');
        window.location.reload();
    }
});

// Tab switching
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Update tabs
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update content
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    
    state.currentTab = tabName;
    
    // Load data
    switch(tabName) {
        case 'programs':
            loadPrograms();
            break;
        case 'broadcasts':
            loadBroadcasts();
            loadProgramsForFilter();
            break;
        case 'authors':
            loadAuthors();
            break;
        case 'learning':
            loadLearning();
            break;
    }
}

// ===== PROGRAMS =====
async function loadPrograms() {
    try {
        const { data, error } = await supabase
            .from(TABLES.programs)
            .select(`
                *,
                authors:author_id (name)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        state.programs = data || [];
    } catch (error) {
        console.error('Error loading programs:', error);
        state.programs = [];
    }
    
    renderProgramsTable();
}

function renderProgramsTable() {
    const tbody = document.getElementById('programsTableBody');
    if (!tbody) return;
    
    if (state.programs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    Программы не найдены
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = state.programs.map(program => `
        <tr>
            <td>${program.id}</td>
            <td><strong>${program.title}</strong></td>
            <td>${program.authors?.name || 'N/A'}</td>
            <td>${new Date(program.created_at).toLocaleDateString('ru-RU')}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-edit" onclick="window.editProgram(${program.id})">✏️ Редактировать</button>
                    <button class="btn-table-delete" onclick="window.deleteProgram(${program.id})">🗑️ Удалить</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Add Program
document.getElementById('addProgramAdminBtn')?.addEventListener('click', () => {
    showProgramModal();
});

function showProgramModal(program = null) {
    const isEdit = !!program;
    
    const modal = createAdminModal(
        isEdit ? 'Редактировать программу' : 'Добавить программу',
        `
            <div class="form-group">
                <label for="programTitle">Название программы:</label>
                <input type="text" id="programTitle" value="${program?.title || ''}" placeholder="Утреннее шоу">
            </div>
            
            <div class="form-group">
                <label for="programAuthor">Автор:</label>
                <select id="programAuthor">
                    <option value="">Выберите автора</option>
                    ${state.authors.map(a => `
                        <option value="${a.id}" ${program?.author_id === a.id ? 'selected' : ''}>
                            ${a.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="programDescription">Краткое описание:</label>
                <textarea id="programDescription" rows="3">${program?.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label for="programImage">URL изображения:</label>
                <input type="text" id="programImage" value="${program?.image_url || ''}" placeholder="https://example.com/image.jpg">
            </div>
            
            <div class="editor-container">
                <label class="editor-label">Полное описание программы:</label>
                <div id="programEditor"></div>
            </div>
        `,
        [
            { label: 'Отмена', class: 'btn-secondary', action: 'cancel' },
            { label: isEdit ? 'Сохранить' : 'Добавить', class: 'btn-primary', action: 'save' }
        ]
    );
    
    // Initialize Quill editor
    const quill = new Quill('#programEditor', {
        theme: 'snow',
        placeholder: 'Напишите полное описание программы...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });
    
    if (program?.full_description) {
        quill.root.innerHTML = program.full_description;
    }
    
    state.currentEditor = quill;
    
    // Load authors if not loaded
    if (state.authors.length === 0) {
        loadAuthorsQuick().then(() => {
            const select = modal.querySelector('#programAuthor');
            select.innerHTML = `
                <option value="">Выберите автора</option>
                ${state.authors.map(a => `
                    <option value="${a.id}" ${program?.author_id === a.id ? 'selected' : ''}>
                        ${a.name}
                    </option>
                `).join('')}
            `;
        });
    }
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeAdminModal);
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const title = modal.querySelector('#programTitle').value.trim();
        const authorId = modal.querySelector('#programAuthor').value;
        const description = modal.querySelector('#programDescription').value.trim();
        const imageUrl = modal.querySelector('#programImage').value.trim();
        const fullDescription = quill.root.innerHTML;
        
        if (!title) {
            alert('Введите название');
            return;
        }
        
        if (!authorId) {
            alert('Выберите автора');
            return;
        }
        
        try {
            const programData = {
                title,
                author_id: authorId,
                description,
                image_url: imageUrl || null,
                full_description: fullDescription
            };
            
            if (isEdit) {
                const { error } = await supabase
                    .from(TABLES.programs)
                    .update(programData)
                    .eq('id', program.id);
                
                if (error) throw error;
                alert('Программа обновлена!');
            } else {
                const { error } = await supabase
                    .from(TABLES.programs)
                    .insert([programData]);
                
                if (error) throw error;
                alert('Программа добавлена!');
            }
            
            closeAdminModal();
            loadPrograms();
        } catch (error) {
            console.error('Error saving program:', error);
            alert('Ошибка: ' + error.message);
        }
    });
}

window.editProgram = async function(id) {
    const program = state.programs.find(p => p.id === id);
    if (!program) {
        try {
            const { data } = await supabase
                .from(TABLES.programs)
                .select('*')
                .eq('id', id)
                .single();
            showProgramModal(data);
        } catch (error) {
            alert('Ошибка загрузки программы');
        }
        return;
    }
    showProgramModal(program);
};

window.deleteProgram = async function(id) {
    if (!confirm('Удалить эту программу и все связанные эфиры?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.programs)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('Программа удалена');
        loadPrograms();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

// ===== BROADCASTS =====
async function loadBroadcasts(programId = null) {
    try {
        let query = supabase
            .from(TABLES.broadcasts)
            .select(`
                *,
                programs:program_id (title)
            `)
            .order('broadcast_date', { ascending: false });
        
        if (programId) {
            query = query.eq('program_id', programId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        state.broadcasts = data || [];
    } catch (error) {
        console.error('Error loading broadcasts:', error);
        state.broadcasts = [];
    }
    
    renderBroadcastsTable();
}

async function loadProgramsForFilter() {
    if (state.programs.length === 0) await loadPrograms();
    
    const select = document.getElementById('filterByProgram');
    if (!select) return;
    
    select.innerHTML = `
        <option value="">Все программы</option>
        ${state.programs.map(p => `
            <option value="${p.id}">${p.title}</option>
        `).join('')}
    `;
    
    select.addEventListener('change', (e) => {
        const programId = e.target.value ? parseInt(e.target.value) : null;
        loadBroadcasts(programId);
    });
}

function renderBroadcastsTable() {
    const tbody = document.getElementById('broadcastsTableBody');
    if (!tbody) return;
    
    if (state.broadcasts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    Эфиры не найдены
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = state.broadcasts.map(broadcast => `
        <tr>
            <td>${broadcast.id}</td>
            <td>${broadcast.programs?.title || 'N/A'}</td>
            <td>${new Date(broadcast.broadcast_date).toLocaleString('ru-RU')}</td>
            <td>${broadcast.link_url ? '✅ Да' : '❌ Нет'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-edit" onclick="window.editBroadcast(${broadcast.id})">✏️ Редактировать</button>
                    <button class="btn-table-delete" onclick="window.deleteBroadcast(${broadcast.id})">🗑️ Удалить</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.editBroadcast = async function(id) {
    const broadcast = state.broadcasts.find(b => b.id === id);
    if (!broadcast) return;
    
    const modal = createAdminModal(
        'Редактировать эфир',
        `
            <div class="form-group">
                <label for="broadcastDate">Дата и время эфира:</label>
                <input type="datetime-local" id="broadcastDate" value="${new Date(broadcast.broadcast_date).toISOString().slice(0, 16)}">
            </div>
            
            <div class="form-group">
                <label for="broadcastLink">Ссылка на запись:</label>
                <input type="url" id="broadcastLink" value="${broadcast.link_url || ''}" placeholder="https://youtube.com/...">
            </div>
            
            <div class="form-group">
                <label for="broadcastImage">URL изображения:</label>
                <input type="url" id="broadcastImage" value="${broadcast.image_url || ''}" placeholder="https://example.com/image.jpg">
            </div>
            
            <div class="editor-container">
                <label class="editor-label">Описание эфира:</label>
                <div id="broadcastEditor"></div>
            </div>
        `,
        [
            { label: 'Отмена', class: 'btn-secondary', action: 'cancel' },
            { label: 'Сохранить', class: 'btn-primary', action: 'save' }
        ]
    );
    
    const quill = new Quill('#broadcastEditor', {
        theme: 'snow',
        placeholder: 'Опишите что было в эфире...',
        modules: {
            toolbar: [
                [{ 'header': [2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });
    
    quill.root.innerHTML = broadcast.content;
    state.currentEditor = quill;
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeAdminModal);
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const date = modal.querySelector('#broadcastDate').value;
        const link = modal.querySelector('#broadcastLink').value.trim();
        const image = modal.querySelector('#broadcastImage').value.trim();
        const content = quill.root.innerHTML;
        
        try {
            const { error } = await supabase
                .from(TABLES.broadcasts)
                .update({
                    broadcast_date: date,
                    content,
                    link_url: link || null,
                    image_url: image || null
                })
                .eq('id', id);
            
            if (error) throw error;
            alert('Эфир обновлён!');
            closeAdminModal();
            loadBroadcasts();
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    });
};

window.deleteBroadcast = async function(id) {
    if (!confirm('Удалить этот эфир?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.broadcasts)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('Эфир удалён');
        loadBroadcasts();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

// ===== AUTHORS =====
async function loadAuthors() {
    try {
        const { data, error } = await supabase
            .from(TABLES.authors)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        state.authors = data || [];
        
        // Get programs for each author
        for (let author of state.authors) {
            const { data: programs } = await supabase
                .from(TABLES.programs)
                .select('title')
                .eq('author_id', author.id);
            author.program = programs?.[0]?.title || null;
        }
    } catch (error) {
        console.error('Error loading authors:', error);
        state.authors = [];
    }
    
    renderAuthorsTable();
}

async function loadAuthorsQuick() {
    try {
        const { data, error } = await supabase
            .from(TABLES.authors)
            .select('id, name')
            .order('name');
        
        if (error) throw error;
        state.authors = data || [];
    } catch (error) {
        console.error('Error loading authors:', error);
    }
}

function renderAuthorsTable() {
    const tbody = document.getElementById('authorsTableBody');
    if (!tbody) return;
    
    if (state.authors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    Авторы не найдены
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = state.authors.map(author => `
        <tr>
            <td>${author.id}</td>
            <td><strong>${author.name}</strong></td>
            <td>${new Date(author.created_at).toLocaleDateString('ru-RU')}</td>
            <td>${author.program || '<span style="color: var(--text-muted);">Нет программы</span>'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-table-delete" onclick="window.deleteAuthor(${author.id})">🗑️ Удалить</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.deleteAuthor = async function(id) {
    if (!confirm('Удалить автора? Это также удалит его программу и все эфиры!')) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.authors)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('Автор удалён');
        loadAuthors();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

// ===== LEARNING =====
async function loadLearning() {
    try {
        const { data, error } = await supabase
            .from(TABLES.learning)
            .select('*')
            .order('order_index');
        
        if (error) throw error;
        state.learningContent = data || [];
    } catch (error) {
        console.error('Error loading learning:', error);
        state.learningContent = [];
    }
    
    renderLearningItems();
}

function renderLearningItems() {
    const container = document.getElementById('learningItems');
    if (!container) return;
    
    if (state.learningContent.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <p>Обучающие материалы не добавлены</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = state.learningContent.map(item => `
        <div class="learning-item-card">
            <h3>${item.title}</h3>
            <p>${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}</p>
            <div class="learning-item-actions">
                <button class="btn-table-edit" onclick="window.editLearning(${item.id})">✏️ Редактировать</button>
                <button class="btn-table-delete" onclick="window.deleteLearning(${item.id})">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
}

document.getElementById('addLearningBtn')?.addEventListener('click', () => {
    showLearningModal();
});

function showLearningModal(item = null) {
    const isEdit = !!item;
    
    const modal = createAdminModal(
        isEdit ? 'Редактировать материал' : 'Добавить материал',
        `
            <div class="form-group">
                <label for="learningTitle">Заголовок:</label>
                <input type="text" id="learningTitle" value="${item?.title || ''}" placeholder="Правила эфира">
            </div>
            
            <div class="form-group">
                <label for="learningCategory">Категория (опционально):</label>
                <input type="text" id="learningCategory" value="${item?.category || ''}" placeholder="Основы">
            </div>
            
            <div class="editor-container">
                <label class="editor-label">Содержание:</label>
                <div id="learningEditor"></div>
            </div>
        `,
        [
            { label: 'Отмена', class: 'btn-secondary', action: 'cancel' },
            { label: isEdit ? 'Сохранить' : 'Добавить', class: 'btn-primary', action: 'save' }
        ]
    );
    
    const quill = new Quill('#learningEditor', {
        theme: 'snow',
        placeholder: 'Напишите содержание материала...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ]
        }
    });
    
    if (item?.content) {
        quill.root.innerHTML = item.content;
    }
    
    state.currentEditor = quill;
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeAdminModal);
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const title = modal.querySelector('#learningTitle').value.trim();
        const category = modal.querySelector('#learningCategory').value.trim();
        const content = quill.root.innerHTML;
        
        if (!title || !content) {
            alert('Заполните заголовок и содержание');
            return;
        }
        
        try {
            const learningData = {
                title,
                category: category || null,
                content,
                order_index: item?.order_index || 0
            };
            
            if (isEdit) {
                const { error } = await supabase
                    .from(TABLES.learning)
                    .update(learningData)
                    .eq('id', item.id);
                
                if (error) throw error;
                alert('Материал обновлён!');
            } else {
                const { error } = await supabase
                    .from(TABLES.learning)
                    .insert([learningData]);
                
                if (error) throw error;
                alert('Материал добавлен!');
            }
            
            closeAdminModal();
            loadLearning();
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    });
}

window.editLearning = async function(id) {
    const item = state.learningContent.find(l => l.id === id);
    if (item) {
        showLearningModal(item);
    }
};

window.deleteLearning = async function(id) {
    if (!confirm('Удалить этот материал?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.learning)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        alert('Материал удалён');
        loadLearning();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
};

// ===== MODAL HELPERS =====
function createAdminModal(title, bodyHTML, actions) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
        <div class="admin-modal">
            <div class="admin-modal-header">
                <h2>${title}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="admin-modal-body">
                ${bodyHTML}
            </div>
            <div class="admin-modal-footer">
                ${actions.map(action => `
                    <button class="${action.class}" data-action="${action.action}">
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('adminModalContainer').appendChild(overlay);
    
    overlay.querySelector('.modal-close').addEventListener('click', closeAdminModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAdminModal();
    });
    
    return overlay;
}

function closeAdminModal() {
    const modal = document.querySelector('.admin-modal-overlay');
    if (modal) {
        state.currentEditor = null;
        modal.remove();
    }
}

// Initialize
function init() {
    if (!checkAuth()) return;
    loadPrograms();
}

document.addEventListener('DOMContentLoaded', init);
