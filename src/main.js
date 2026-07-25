import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabaseUrl, supabaseKey, TABLES, STORAGE_KEYS } from './config.js';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Application State
const state = {
    currentSection: 'home',
    currentProgram: null,
    currentAuthor: null,
    programs: [],
    isEditMode: false
};

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.content-section');
const authorLoginBtn = document.getElementById('authorLoginBtn');
const programsContainer = document.getElementById('programsContainer');
const createProgramBtn = document.getElementById('createProgramBtn');
const authorControls = document.getElementById('authorControls');
const modalContainer = document.getElementById('modalContainer');
const programDetailContent = document.getElementById('programDetailContent');

// Check if author is logged in
function checkAuthorAuth() {
    const authorId = localStorage.getItem(STORAGE_KEYS.authorId);
    const authorName = localStorage.getItem(STORAGE_KEYS.authorName);
    
    if (authorId && authorName) {
        state.currentAuthor = { id: authorId, name: authorName };
        updateAuthorUI();
    }
}

function updateAuthorUI() {
    if (state.currentAuthor) {
        authorLoginBtn.textContent = '👤';
        authorLoginBtn.style.background = 'var(--primary-color)';
        authorLoginBtn.title = `Вы вошли как ${state.currentAuthor.name}`;
        
        if (state.currentSection === 'schedule') {
            authorControls.style.display = 'block';
        }
    } else {
        authorLoginBtn.textContent = '👤';
        authorLoginBtn.style.background = '';
        authorLoginBtn.title = 'Вход для авторов';
        authorControls.style.display = 'none';
    }
}

// Navigation
function navigateToSection(sectionId) {
    sections.forEach(section => section.classList.remove('active'));
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    const targetSection = document.getElementById(sectionId);
    const targetBtn = document.querySelector(`[data-section="${sectionId}"]`);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    state.currentSection = sectionId;
    
    // Load section-specific content
    if (sectionId === 'schedule') {
        loadPrograms();
        updateAuthorUI();
    } else if (sectionId === 'leadership') {
        loadLeadership();
    } else if (sectionId === 'staff') {
        loadStaff();
    }
}

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        navigateToSection(section);
    });
});

// Quick links navigation
document.querySelectorAll('[data-navigate]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToSection(link.dataset.navigate);
    });
});

// Modal System
function createModal(title, content, actions = []) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            <div class="modal-actions">
                ${actions.map(action => `
                    <button class="${action.class || 'btn-secondary'}" data-action="${action.action}">
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    modalContainer.appendChild(modal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Close button
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    return modal;
}

function closeModal() {
    const modal = modalContainer.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Author Login
authorLoginBtn.addEventListener('click', () => {
    if (state.currentAuthor) {
        showAuthorMenu();
    } else {
        showAuthorLoginModal();
    }
});

function showAuthorLoginModal() {
    const modal = createModal(
        'Вход для авторов',
        `
            <div class="form-group">
                <label for="authorNameInput">Ваше имя (игровой ник):</label>
                <input type="text" id="authorNameInput" placeholder="John_Smith">
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 1rem;">
                Введите ваш игровой ник. Если у вас ещё нет программы, вы сможете создать её после входа.
            </p>
        `,
        [
            { label: 'Отмена', action: 'cancel', class: 'btn-secondary' },
            { label: 'Войти', action: 'login', class: 'btn-primary' }
        ]
    );
    
    const nameInput = modal.querySelector('#authorNameInput');
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    modal.querySelector('[data-action="login"]').addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            alert('Введите ваше имя');
            return;
        }
        
        try {
            // Check if author exists
            const { data: existingAuthor } = await supabase
                .from(TABLES.authors)
                .select('*')
                .eq('name', name)
                .single();
            
            let authorId;
            if (existingAuthor) {
                authorId = existingAuthor.id;
            } else {
                // Create new author
                const { data: newAuthor, error } = await supabase
                    .from(TABLES.authors)
                    .insert([{ name }])
                    .select()
                    .single();
                
                if (error) throw error;
                authorId = newAuthor.id;
            }
            
            // Save to localStorage
            localStorage.setItem(STORAGE_KEYS.authorId, authorId);
            localStorage.setItem(STORAGE_KEYS.authorName, name);
            
            state.currentAuthor = { id: authorId, name };
            updateAuthorUI();
            closeModal();
            
            alert(`Добро пожаловать, ${name}!`);
            
            // Check if author has program
            checkAuthorProgram();
            
        } catch (error) {
            console.error('Error logging in:', error);
            // For development without Supabase
            const fakeId = Date.now().toString();
            localStorage.setItem(STORAGE_KEYS.authorId, fakeId);
            localStorage.setItem(STORAGE_KEYS.authorName, name);
            state.currentAuthor = { id: fakeId, name };
            updateAuthorUI();
            closeModal();
            alert(`Добро пожаловать, ${name}!`);
        }
    });
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            modal.querySelector('[data-action="login"]').click();
        }
    });
    
    setTimeout(() => nameInput.focus(), 100);
}

function showAuthorMenu() {
    const modal = createModal(
        `Меню автора`,
        `
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Вы вошли как <strong style="color: var(--primary-color);">${state.currentAuthor.name}</strong>
            </p>
            <button class="btn-primary" style="width: 100%; margin-bottom: 0.5rem;" id="myProgramBtn">
                📻 Моя программа
            </button>
            <button class="btn-secondary" style="width: 100%;" id="logoutBtn">
                Выйти
            </button>
        `,
        []
    );
    
    modal.querySelector('#myProgramBtn').addEventListener('click', async () => {
        closeModal();
        await checkAuthorProgram();
    });
    
    modal.querySelector('#logoutBtn').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.authorId);
        localStorage.removeItem(STORAGE_KEYS.authorName);
        state.currentAuthor = null;
        updateAuthorUI();
        closeModal();
        if (state.currentSection === 'schedule') {
            loadPrograms();
        }
    });
}

async function checkAuthorProgram() {
    if (!state.currentAuthor) return;
    
    try {
        const { data: program } = await supabase
            .from(TABLES.programs)
            .select('*')
            .eq('author_id', state.currentAuthor.id)
            .single();
        
        if (program) {
            navigateToSection('schedule');
            viewProgram(program.id);
        } else {
            navigateToSection('schedule');
            alert('У вас ещё нет программы. Создайте её, нажав кнопку "Создать мою программу"');
        }
    } catch (error) {
        console.error('Error checking program:', error);
        navigateToSection('schedule');
    }
}

// Programs Loading
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
        // Sample data for development
        state.programs = getSamplePrograms();
    }
    
    renderPrograms();
}

function getSamplePrograms() {
    return [
        {
            id: 1,
            title: 'Утреннее шоу',
            author_id: 'sample1',
            authors: { name: 'John_Smith' },
            description: 'Начните свой день с отличной музыки!',
            image_url: null,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Вечерний драйв',
            author_id: 'sample2',
            authors: { name: 'Sarah_Johnson' },
            description: 'Лучшая музыка для дороги домой.',
            image_url: null,
            created_at: new Date().toISOString()
        }
    ];
}

function renderPrograms() {
    if (!programsContainer) return;
    
    if (state.programs.length === 0) {
        programsContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px;">
                <h3 style="color: var(--text-secondary); margin-bottom: 1rem;">Программы пока не созданы</h3>
                ${state.currentAuthor ? '<p>Создайте первую программу!</p>' : '<p>Войдите как автор чтобы создать программу</p>'}
            </div>
        `;
        return;
    }
    
    programsContainer.innerHTML = state.programs.map(program => {
        const authorName = program.authors?.name || 'Неизвестный автор';
        const isOwner = state.currentAuthor && program.author_id === state.currentAuthor.id;
        
        return `
            <div class="program-card" data-id="${program.id}">
                <div class="program-image">
                    ${program.image_url 
                        ? `<img src="${program.image_url}" alt="${program.title}">`
                        : '📻'
                    }
                </div>
                <div class="program-content">
                    <h3>${program.title}</h3>
                    <div class="program-host">Автор: ${authorName}</div>
                    <div class="program-description">${program.description || 'Описание скоро появится'}</div>
                    <div style="margin-top: 1.5rem;">
                        <button class="btn-primary" onclick="window.viewProgram(${program.id})" style="width: 100%;">
                            Подробнее →
                        </button>
                    </div>
                    ${isOwner ? `
                        <div style="margin-top: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                            <span style="color: var(--primary-color); font-size: 0.85rem;">✓ Ваша программа</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// View Program Detail
window.viewProgram = async function(programId) {
    state.currentProgram = state.programs.find(p => p.id === programId);
    
    if (!state.currentProgram) {
        try {
            const { data } = await supabase
                .from(TABLES.programs)
                .select(`*, authors:author_id (name)`)
                .eq('id', programId)
                .single();
            state.currentProgram = data;
        } catch (error) {
            console.error('Error loading program:', error);
            return;
        }
    }
    
    navigateToSection('program-detail');
    await renderProgramDetail();
};

async function renderProgramDetail() {
    const program = state.currentProgram;
    if (!program) return;
    
    const isOwner = state.currentAuthor && program.author_id === state.currentAuthor.id;
    const authorName = program.authors?.name || 'Неизвестный автор';
    
    // Load broadcasts
    let broadcasts = [];
    try {
        const { data } = await supabase
            .from(TABLES.broadcasts)
            .select('*')
            .eq('program_id', program.id)
            .order('broadcast_date', { ascending: false });
        broadcasts = data || [];
    } catch (error) {
        console.error('Error loading broadcasts:', error);
    }
    
    // Generate shareable link
    const programUrl = `${window.location.origin}${window.location.pathname}?program=${program.id}`;
    
    programDetailContent.innerHTML = `
        <div class="program-detail-header">
            <button class="btn-back" onclick="window.history.back(); window.navigateToSection('schedule');">
                ← Назад к программам
            </button>
            
            <button class="copy-section-link" id="copyProgramLink" style="margin-bottom: 2rem;">
                🔗 Скопировать ссылку на программу
            </button>
            
            <div class="program-detail-hero">
                <div class="program-detail-image">
                    ${program.image_url 
                        ? `<img src="${program.image_url}" alt="${program.title}">`
                        : '<div class="program-placeholder">📻</div>'
                    }
                </div>
                <div class="program-detail-info">
                    <h1>${program.title}</h1>
                    <p class="program-author">Автор: ${authorName}</p>
                    ${isOwner ? `
                        <button class="btn-primary" id="editProgramBtn">✏️ Редактировать описание</button>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <div class="program-detail-body">
            <div class="program-description-full" id="programDescriptionView">
                ${program.full_description || program.description || '<p style="color: var(--text-secondary);">Описание программы скоро появится...</p>'}
            </div>
            
            <div class="broadcast-archive-section">
                <div class="section-header" style="margin-bottom: 2rem;">
                    <h2>Архив эфиров</h2>
                    ${isOwner ? `
                        <button class="btn-primary" id="addBroadcastBtn">+ Добавить запись</button>
                    ` : ''}
                </div>
                
                <div class="broadcasts-list" id="broadcastsList">
                    ${broadcasts.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                            <p>Записей об эфирах пока нет</p>
                        </div>
                    ` : broadcasts.map(broadcast => `
                        <div class="broadcast-item">
                            <div class="broadcast-header">
                                <div class="broadcast-date">${formatDate(broadcast.broadcast_date)}</div>
                                ${isOwner ? `
                                    <div class="broadcast-actions">
                                        <button class="btn-edit-small" onclick="window.editBroadcast(${broadcast.id})">✏️</button>
                                        <button class="btn-delete-small" onclick="window.deleteBroadcast(${broadcast.id})">🗑️</button>
                                    </div>
                                ` : ''}
                            </div>
                            ${broadcast.image_url ? `
                                <div class="broadcast-image">
                                    <img src="${broadcast.image_url}" alt="Эфир">
                                </div>
                            ` : ''}
                            <div class="broadcast-content">
                                ${broadcast.content}
                            </div>
                            ${broadcast.link_url ? `
                                <a href="${broadcast.link_url}" target="_blank" class="broadcast-link-btn">
                                    🎵 Послушать запись
                                </a>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Attach event listeners
    const copyLinkBtn = document.getElementById('copyProgramLink');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            copyToClipboard(programUrl);
            copyLinkBtn.textContent = '✓ Ссылка скопирована!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '🔗 Скопировать ссылку на программу';
            }, 2000);
        });
    }
    
    if (isOwner) {
        const editBtn = document.getElementById('editProgramBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => showEditProgramModal());
        }
        
        const addBroadcastBtn = document.getElementById('addBroadcastBtn');
        if (addBroadcastBtn) {
            addBroadcastBtn.addEventListener('click', () => showAddBroadcastModal());
        }
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Create Program
if (createProgramBtn) {
    createProgramBtn.addEventListener('click', showCreateProgramModal);
}

function showCreateProgramModal() {
    if (!state.currentAuthor) {
        alert('Войдите как автор для создания программы');
        return;
    }
    
    const modal = createModal(
        'Создать программу',
        `
            <div class="form-group">
                <label for="programTitle">Название программы:</label>
                <input type="text" id="programTitle" placeholder="Утреннее шоу">
            </div>
            <div class="form-group">
                <label for="programDescription">Краткое описание:</label>
                <textarea id="programDescription" rows="3" placeholder="Краткое описание программы..."></textarea>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 1rem;">
                Вы сможете добавить полное описание и архив эфиров после создания программы.
            </p>
        `,
        [
            { label: 'Отмена', action: 'cancel', class: 'btn-secondary' },
            { label: 'Создать', action: 'create', class: 'btn-primary' }
        ]
    );
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    modal.querySelector('[data-action="create"]').addEventListener('click', async () => {
        const title = modal.querySelector('#programTitle').value.trim();
        const description = modal.querySelector('#programDescription').value.trim();
        
        if (!title) {
            alert('Введите название программы');
            return;
        }
        
        try {
            const newProgram = {
                title,
                description,
                author_id: state.currentAuthor.id,
                full_description: '<p>Здесь будет описание вашей программы...</p>'
            };
            
            const { data, error } = await supabase
                .from(TABLES.programs)
                .insert([newProgram])
                .select()
                .single();
            
            if (error) throw error;
            
            closeModal();
            alert('Программа создана!');
            await loadPrograms();
            viewProgram(data.id);
            
        } catch (error) {
            console.error('Error creating program:', error);
            alert('Ошибка при создании программы. Проверьте настройки Supabase.');
        }
    });
}

// Show Edit Program Modal
function showEditProgramModal() {
    const program = state.currentProgram;
    
    const modal = createModal(
        'Редактировать программу',
        `
            <div class="form-group">
                <label for="editProgramTitle">Название:</label>
                <input type="text" id="editProgramTitle" value="${program.title}">
            </div>
            <div class="form-group">
                <label for="editProgramImage">URL изображения:</label>
                <input type="text" id="editProgramImage" value="${program.image_url || ''}" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-group">
                <label for="editProgramFullDescription">Полное описание (HTML):</label>
                <textarea id="editProgramFullDescription" rows="10" style="font-family: monospace; font-size: 0.9rem;">${program.full_description || ''}</textarea>
                <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
                    Используйте HTML теги для форматирования: &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;img&gt; и т.д.
                </small>
            </div>
        `,
        [
            { label: 'Отмена', action: 'cancel', class: 'btn-secondary' },
            { label: 'Сохранить', action: 'save', class: 'btn-primary' }
        ]
    );
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const title = modal.querySelector('#editProgramTitle').value.trim();
        const imageUrl = modal.querySelector('#editProgramImage').value.trim();
        const fullDescription = modal.querySelector('#editProgramFullDescription').value.trim();
        
        if (!title) {
            alert('Введите название');
            return;
        }
        
        try {
            const { error } = await supabase
                .from(TABLES.programs)
                .update({
                    title,
                    image_url: imageUrl || null,
                    full_description: fullDescription
                })
                .eq('id', program.id);
            
            if (error) throw error;
            
            // Update local state
            program.title = title;
            program.image_url = imageUrl || null;
            program.full_description = fullDescription;
            
            closeModal();
            alert('Программа обновлена!');
            renderProgramDetail();
            
        } catch (error) {
            console.error('Error updating program:', error);
            alert('Ошибка при обновлении');
        }
    });
}

// Add Broadcast Modal
function showAddBroadcastModal() {
    const modal = createModal(
        'Добавить запись об эфире',
        `
            <div class="form-group">
                <label for="broadcastDate">Дата и время эфира:</label>
                <input type="datetime-local" id="broadcastDate">
            </div>
            <div class="form-group">
                <label for="broadcastContent">Описание эфира (HTML):</label>
                <textarea id="broadcastContent" rows="6" style="font-family: monospace; font-size: 0.9rem;" placeholder="<p>Описание...</p>"></textarea>
                <small style="color: var(--text-secondary);">Используйте HTML для форматирования</small>
            </div>
            <div class="form-group">
                <label for="broadcastLink">Ссылка на запись (опционально):</label>
                <input type="url" id="broadcastLink" placeholder="https://youtube.com/...">
            </div>
            <div class="form-group">
                <label for="broadcastImage">URL изображения (опционально):</label>
                <input type="url" id="broadcastImage" placeholder="https://example.com/image.jpg">
            </div>
        `,
        [
            { label: 'Отмена', action: 'cancel', class: 'btn-secondary' },
            { label: 'Добавить', action: 'add', class: 'btn-primary' }
        ]
    );
    
    // Set current date/time as default
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    modal.querySelector('#broadcastDate').value = now.toISOString().slice(0, 16);
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    modal.querySelector('[data-action="add"]').addEventListener('click', async () => {
        const date = modal.querySelector('#broadcastDate').value;
        const content = modal.querySelector('#broadcastContent').value.trim();
        const link = modal.querySelector('#broadcastLink').value.trim();
        const image = modal.querySelector('#broadcastImage').value.trim();
        
        if (!date || !content) {
            alert('Заполните дату и описание');
            return;
        }
        
        try {
            const { error } = await supabase
                .from(TABLES.broadcasts)
                .insert([{
                    program_id: state.currentProgram.id,
                    broadcast_date: date,
                    content,
                    link_url: link || null,
                    image_url: image || null
                }]);
            
            if (error) throw error;
            
            closeModal();
            alert('Запись добавлена!');
            renderProgramDetail();
            
        } catch (error) {
            console.error('Error adding broadcast:', error);
            alert('Ошибка при добавлении записи');
        }
    });
}

// Edit/Delete Broadcast
window.editBroadcast = async function(broadcastId) {
    try {
        const { data: broadcast } = await supabase
            .from(TABLES.broadcasts)
            .select('*')
            .eq('id', broadcastId)
            .single();
        
        if (!broadcast) return;
        
        const modal = createModal(
            'Редактировать запись',
            `
                <div class="form-group">
                    <label for="editBroadcastDate">Дата и время:</label>
                    <input type="datetime-local" id="editBroadcastDate" value="${new Date(broadcast.broadcast_date).toISOString().slice(0, 16)}">
                </div>
                <div class="form-group">
                    <label for="editBroadcastContent">Описание:</label>
                    <textarea id="editBroadcastContent" rows="6" style="font-family: monospace; font-size: 0.9rem;">${broadcast.content}</textarea>
                </div>
                <div class="form-group">
                    <label for="editBroadcastLink">Ссылка:</label>
                    <input type="url" id="editBroadcastLink" value="${broadcast.link_url || ''}">
                </div>
                <div class="form-group">
                    <label for="editBroadcastImage">Изображение:</label>
                    <input type="url" id="editBroadcastImage" value="${broadcast.image_url || ''}">
                </div>
            `,
            [
                { label: 'Отмена', action: 'cancel', class: 'btn-secondary' },
                { label: 'Сохранить', action: 'save', class: 'btn-primary' }
            ]
        );
        
        modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
        modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
            const date = modal.querySelector('#editBroadcastDate').value;
            const content = modal.querySelector('#editBroadcastContent').value.trim();
            const link = modal.querySelector('#editBroadcastLink').value.trim();
            const image = modal.querySelector('#editBroadcastImage').value.trim();
            
            const { error } = await supabase
                .from(TABLES.broadcasts)
                .update({
                    broadcast_date: date,
                    content,
                    link_url: link || null,
                    image_url: image || null
                })
                .eq('id', broadcastId);
            
            if (!error) {
                closeModal();
                alert('Запись обновлена!');
                renderProgramDetail();
            }
        });
    } catch (error) {
        console.error('Error editing broadcast:', error);
    }
};

window.deleteBroadcast = async function(broadcastId) {
    if (!confirm('Удалить эту запись?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLES.broadcasts)
            .delete()
            .eq('id', broadcastId);
        
        if (!error) {
            alert('Запись удалена');
            renderProgramDetail();
        }
    } catch (error) {
        console.error('Error deleting broadcast:', error);
    }
};

// Leadership Section
function loadLeadership() {
    const leadershipContent = document.getElementById('leadershipContent');
    if (!leadershipContent) return;
    
    // Get current URL for copy link functionality
    const currentUrl = window.location.href.split('#')[0] + '#leadership';
    
    // Leadership data structure with rank limits
    const leadershipData = [
        {
            rank: 10,
            rankName: 'Директор',
            limit: 1,
            positions: [
                { name: 'Henry Urban', position: 'Директор', phone: '873', photo: 'https://i.imgur.com/L0ATYfb.png' }
                // Add your leadership members here
                // Example: { name: 'John_Smith', position: 'Директор', phone: '555-0001', photo: 'https://example.com/photo.jpg' }
            ]
        },
        {
            rank: 9,
            rankName: 'Заместители',
            limit: 4,
            positions: [
                { name: 'Wu Ji', position: 'Заместитель Директора', phone: '1109', photo: 'https://i.imgur.com/yIoBg4E.png' }
                // Add your leadership members here
                // Example: { name: 'John_Smith', position: 'Директор', phone: '555-0001', photo: 'https://example.com/photo.jpg' }
            ]
        },
        {
            rank: 8,
            rankName: 'Редактор',
            limit: 6,
            positions: [{ name: 'Felix Davinci', position: 'Редактор', phone: '---', photo: 'https://i.imgur.com/TIR7jpA.png' }]
        },
        {
            rank: 7,
            rankName: '7 ранг',
            limit: 8,
            positions: []
        }
    ];
    
    leadershipContent.innerHTML = `
        <button class="copy-section-link" id="copyLeadershipLink">
            🔗 Скопировать ссылку на этот раздел
        </button>
        
        ${leadershipData.map(rankData => `
            <div class="rank-section">
                <div class="rank-header">
                    <div class="rank-title">
                        <span class="rank-badge">${rankData.rank}</span>
                        <span>${rankData.rankName}</span>
                    </div>
                    <div class="rank-limit">
                        Лимит: ${rankData.positions.length} / ${rankData.limit} мест
                    </div>
                </div>
                
                <div class="leaders-grid">
                    ${rankData.positions.map(leader => `
                        <div class="leader-card">
                            <div class="leader-photo">
                                ${leader.photo 
                                    ? `<img src="${leader.photo}" alt="${leader.name}">`
                                    : '👤'
                                }
                            </div>
                            <div class="leader-position">${leader.position}</div>
                            <div class="leader-name">${leader.name}</div>
                            <div class="leader-phone" onclick="copyToClipboard('${leader.phone}')">
                                📞 ${leader.phone}
                            </div>
                        </div>
                    `).join('')}
                    
                    ${Array(rankData.limit - rankData.positions.length).fill(0).map(() => `
                        <div class="empty-slot">
                            Вакансия
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
    
    // Attach copy link event listener
    const copyLinkBtn = document.getElementById('copyLeadershipLink');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            copyToClipboard(currentUrl);
            copyLinkBtn.textContent = '✓ Ссылка скопирована!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '🔗 Скопировать ссылку на этот раздел';
            }, 2000);
        });
    }
}

// Staff Section
function loadStaff() {
    const staffContent = document.getElementById('staffContent');
    if (!staffContent) return;

    const baseUrl = window.location.href.split('#')[0];
    const staffUrl = baseUrl + '#staff';
//members: [
//    { name: 'John_Smith', position: 'Контролёр', phone: '555', photo: 'https://...' }
// ]

    // Department data: each dept has a curator card + subsection with ranked members
    const departments = [
        {
            id: 'dept-quality-publishing',
            icon: '📰',
            name: 'Отдел Контроля Качества Издательства',
            shortName: 'ОКК Издательства',
            curator: {
                name: 'Wu Ji',
                role: 'Куратор отдела',
                photo: 'https://i.imgur.com/yIoBg4E.png'
            },
            ranks: [
                { rank: 10, rankName: 'Куратор Отдела', limit: 1, members: [{ name: 'Wu Ji', position: 'Куратор', phone: '1109', photo: 'https://i.imgur.com/yIoBg4E.png' }] },
                { rank: 5, rankName: 'Помощники Куратора и редакторы материала', limit: 2, members: [] }
            ]
        },
        {
            id: 'dept-quality-editing',
            icon: '✏️',
            name: 'Отдел Контроля Качества Редактуры Объявлений',
            shortName: 'ОКК Редактуры',
            curator: {
                name: 'Вакансия',
                role: 'Куратор отдела',
                photo: null
            },
            ranks: [
                { rank: 10, rankName: 'Куратор Отдела', limit: 1, members: [] },
                { rank: 5, rankName: 'Помощники Куратора', limit: 2, members: [] }
            ]
        },
        {
            id: 'dept-quality-broadcast',
            icon: '🎙️',
            name: 'Отдел Контроля Качества Проведения Эфиров',
            shortName: 'ОКК Эфиров',
            curator: {
                name: 'Вакансия',
                role: 'Куратор отдела',
                photo: null
            },
            ranks: [
                { rank: 10, rankName: 'Куратор Отдела', limit: 1, members: [] },
                { rank: 5, rankName: 'Помощники Куратора', limit: 2, members: [] }
            ]
        }
    ];

    // Build HTML: copy-link button + curator nav cards + hidden subsections
    staffContent.innerHTML = `
        <button class="copy-section-link" id="copyStaffLink">
            🔗 Скопировать ссылку на этот раздел
        </button>

        <div class="dept-nav-grid" id="deptNavGrid">
            ${departments.map(dept => `
                <div class="dept-nav-card" data-dept="${dept.id}" role="button" tabindex="0"
                     aria-label="Перейти к разделу ${dept.name}">
                    <div class="dept-curator-photo">
                        ${dept.curator.photo
                            ? `<img src="${dept.curator.photo}" alt="${dept.curator.name}">`
                            : dept.icon}
                    </div>
                    <div class="dept-curator-role">${dept.curator.role}</div>
                    <div class="dept-curator-name">${dept.curator.name}</div>
                    <div class="dept-nav-label">${dept.name}</div>
                    <span class="dept-nav-arrow">↓</span>
                </div>
            `).join('')}
        </div>

        ${departments.map(dept => `
            <div class="dept-subsection" id="${dept.id}">
                <div class="dept-subsection-header">
                    <div class="dept-subsection-title">
                        <span class="dept-subsection-icon">${dept.icon}</span>
                        ${dept.name}
                    </div>
                    <button class="dept-back-btn" data-dept-close="${dept.id}">
                        ↑ Свернуть
                    </button>
                </div>

                ${dept.ranks.map(rankData => `
                    <div class="rank-section" style="margin-bottom: 2rem;">
                        <div class="rank-header">
                            <div class="rank-title">
                                <span class="rank-badge">${rankData.rank}</span>
                                <span>${rankData.rankName}</span>
                            </div>
                            <div class="rank-limit">
                                Лимит: ${rankData.members.length} / ${rankData.limit} мест
                            </div>
                        </div>
                        <div class="leaders-grid">
                            ${rankData.members.map(member => `
                                <div class="leader-card">
                                    <div class="leader-photo">
                                        ${member.photo
                                            ? `<img src="${member.photo}" alt="${member.name}">`
                                            : '👤'}
                                    </div>
                                    <div class="leader-position">${member.position}</div>
                                    <div class="leader-name">${member.name}</div>
                                    <div class="leader-phone" onclick="copyToClipboard('${member.phone}')">
                                        📞 ${member.phone}
                                    </div>
                                </div>
                            `).join('')}
                            ${Array(rankData.limit - rankData.members.length).fill(0).map(() => `
                                <div class="empty-slot">Вакансия</div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    `;

    // Copy link button
    const copyLinkBtn = document.getElementById('copyStaffLink');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            copyToClipboard(staffUrl);
            copyLinkBtn.textContent = '✓ Ссылка скопирована!';
            setTimeout(() => {
                copyLinkBtn.innerHTML = '🔗 Скопировать ссылку на этот раздел';
            }, 2000);
        });
    }

    // Nav card clicks — toggle subsection
    staffContent.querySelectorAll('.dept-nav-card').forEach(card => {
        const activate = () => {
            const deptId = card.dataset.dept;
            const subsection = document.getElementById(deptId);
            const isOpen = subsection.classList.contains('active-subsection');

            // Close all subsections and deactivate all nav cards
            staffContent.querySelectorAll('.dept-subsection').forEach(s => s.classList.remove('active-subsection'));
            staffContent.querySelectorAll('.dept-nav-card').forEach(c => c.classList.remove('active-dept'));

            if (!isOpen) {
                subsection.classList.add('active-subsection');
                card.classList.add('active-dept');
                // Smooth scroll to subsection
                setTimeout(() => subsection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            }
        };

        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
    });

    // Close/collapse buttons inside subsections
    staffContent.querySelectorAll('[data-dept-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const deptId = btn.dataset.deptClose;
            document.getElementById(deptId).classList.remove('active-subsection');
            staffContent.querySelector(`[data-dept="${deptId}"]`)?.classList.remove('active-dept');
            // Scroll back to nav grid
            document.getElementById('deptNavGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// Copy to clipboard helper
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard:', text);
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        console.log('Copied to clipboard (fallback):', text);
    } catch (err) {
        console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
}

// Make functions available globally
window.navigateToSection = navigateToSection;
window.copyToClipboard = copyToClipboard;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuthorAuth();
    
    // Check if URL has program parameter for direct link
    const urlParams = new URLSearchParams(window.location.search);
    const programId = urlParams.get('program');
    
    if (programId) {
        // Load programs first, then open the specific program
        loadPrograms().then(() => {
            setTimeout(() => viewProgram(parseInt(programId)), 100);
        });
    } else {
        navigateToSection('home');
        
        // Check if URL has hash for direct navigation
        if (window.location.hash) {
            const sectionId = window.location.hash.substring(1);
            if (sectionId) {
                setTimeout(() => navigateToSection(sectionId), 100);
            }
        }
    }
});
