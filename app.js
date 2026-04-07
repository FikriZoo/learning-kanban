// =============================================
//  PERSONAL LEARNING KANBAN — APP LOGIC
//  Data: LocalStorage  |  Drag-and-drop: HTML5
// =============================================

// ---- STATE ----
let tasks = JSON.parse(localStorage.getItem('kanban_tasks') || 'null') || [
  { id: uid(), title: 'Advanced CSS Grid Layouts', desc: 'Mastering complex grid areas and responsive patterns for editorial design.', priority: 'HIGH', status: 'todo', link: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', createdAt: Date.now() - 86400000 },
  { id: uid(), title: 'Typography Theory', desc: 'Study of geometric san-serifs and their emotional impact on readability.', priority: 'MEDIUM', status: 'todo', link: 'https://practicaltypography.com/', createdAt: Date.now() - 72000000 },
  { id: uid(), title: 'Color Psychology in UX', desc: 'Understanding how botanical tones influence cognitive load and focus.', priority: 'MEDIUM', status: 'inprogress', link: 'https://www.interaction-design.org/literature/topics/color-theory', createdAt: Date.now() - 48000000 },
  { id: uid(), title: 'Basics of Micro-interactions', desc: 'Introduction to ease-out curves and 300ms timing rules.', priority: 'LOW', status: 'done', link: 'https://microinteractions.com/', createdAt: Date.now() - 36000000 },
];

let notes = JSON.parse(localStorage.getItem('kanban_notes') || 'null') || [
  { id: uid(), title: 'MDN Web Docs', link: 'https://developer.mozilla.org', desc: 'Comprehensive web documentation', category: 'Docs' },
  { id: uid(), title: 'CSS Tricks', link: 'https://css-tricks.com', desc: 'Tips & tricks for CSS and frontend', category: 'Article' },
  { id: uid(), title: 'Frontend Mentor', link: 'https://frontendmentor.io', desc: 'Practice projects for frontend devs', category: 'GitHub' },
];

let currentView = 'dashboard';
let draggedId   = null;
let editingTaskId = null;

// ---- HELPERS ----
async function save() {
  // Simpan ke LocalStorage (untuk backup cepat di browser ini)
  localStorage.setItem('kanban_tasks', JSON.stringify(tasks));
  localStorage.setItem('kanban_notes', JSON.stringify(notes));

  // KIRIM KE FIREBASE (Ini yang bikin sinkron antar browser/HP)
  if (typeof db !== 'undefined') {
    try {
      await db.collection("learning_data").doc("user_1").set({
        tasks: tasks,
        notes: notes,
        lastUpdated: Date.now()
      });
      console.log("✓ Berhasil sinkron ke Cloud!");
    } catch (error) {
      console.error("Gagal sinkron ke Firebase:", error);
    }
  }
}

function query() {
  return document.getElementById('searchInput').value.toLowerCase();
}

function matchesQuery(task) {
  const q = query();
  return !q || task.title.toLowerCase().includes(q) || (task.desc || '').toLowerCase().includes(q);
}

// ---- RENDER ALL ----
function renderAll() {
  renderBoard();
  renderListView('all',        tasks.filter(matchesQuery));
  renderListView('inprogress', tasks.filter(t => t.status === 'inprogress' && matchesQuery(t)));
  renderListView('done',       tasks.filter(t => t.status === 'done'       && matchesQuery(t)));
  renderNotes();
}

// ---- BOARD ----
function renderBoard() {
  const board = document.getElementById('board');
  const columns = [
    { key: 'todo',       label: 'To Do',       cls: 'todo' },
    { key: 'inprogress', label: 'In Progress',  cls: 'inprogress' },
    { key: 'done',       label: 'Done',         cls: 'done' },
  ];

  board.innerHTML = columns.map(col => {
    const colTasks = tasks.filter(t => t.status === col.key && matchesQuery(t));
    return `
      <div class="column ${col.cls}"
           data-status="${col.key}"
           ondragover="dragOver(event)"
           ondrop="drop(event)"
           ondragenter="dragEnter(event)"
           ondragleave="dragLeave(event)">
        <div class="column-header">
          <div class="column-title-wrap">
            <div class="status-dot"></div>
            <span class="column-title">${col.label}</span>
          </div>
          <span class="column-count">${colTasks.length}</span>
        </div>
        ${colTasks.map(t => cardHTML(t)).join('')}
        <button class="btn-add-task" onclick="openTaskModal(null,'${col.key}')">+ Add Task</button>
      </div>`;
  }).join('');
}

function cardHTML(task) {
  const isDone = task.status === 'done';
  const progress = isDone ? 100 : task.status === 'inprogress' ? 55 : 0;

  return `
    <div class="card ${isDone ? 'done' : ''}"
         draggable="true"
         data-id="${task.id}"
         ondragstart="dragStart(event, '${task.id}')"
         ondragend="dragEnd(event)"
         onclick="openDetail('${task.id}')">
      <div class="priority-badge priority-${task.priority}">${task.priority}</div>
      <div class="card-title">${escHtml(task.title)}</div>
      ${task.desc ? `<div class="card-desc">${escHtml(task.desc)}</div>` : ''}
      ${task.status === 'inprogress' ? `
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>` : ''}
      <div class="card-footer">
        ${task.link
          ? `<a class="btn-open-docs" href="${task.link}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
               Open Docs
             </a>`
          : `<span></span>`}
        ${isDone
          ? `<div class="card-done-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>`
          : `<button class="card-menu-btn" onclick="event.stopPropagation(); openTaskModal('${task.id}')">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
             </button>`}
      </div>
    </div>`;
}

// ---- LIST VIEW ----
function renderListView(view, list) {
  const container = document.getElementById(`list-${view}`);
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      <p>Tidak ada task di sini</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(task => `
    <div class="list-card" onclick="openDetail('${task.id}')">
      <div class="priority-badge priority-${task.priority}">${task.priority}</div>
      <div class="list-card-body">
        <div class="list-card-title">${escHtml(task.title)}</div>
        ${task.desc ? `<div class="list-card-desc">${escHtml(task.desc)}</div>` : ''}
      </div>
      <span class="list-card-status status-${task.status}">
        ${{ todo: 'To Do', inprogress: 'In Progress', done: 'Done' }[task.status]}
      </span>
    </div>`
  ).join('');
}

// ---- NOTES ----
function renderNotes() {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;

  if (notes.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <p>Belum ada notes. Tambahkan link penting!</p>
    </div>`;
    return;
  }

  grid.innerHTML = notes.map(n => `
    <div class="note-card">
      <div class="note-category">${escHtml(n.category)}</div>
      <div class="note-title">${escHtml(n.title)}</div>
      ${n.desc ? `<div class="note-desc">${escHtml(n.desc)}</div>` : ''}
      <a class="note-link" href="${n.link}" target="_blank" rel="noopener noreferrer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Buka Link
      </a>
      <div class="note-actions">
        <span style="font-size:11px; color:var(--warm-500);">${n.link.replace(/^https?:\/\//,'').split('/')[0]}</span>
        <button class="btn-note-del" onclick="deleteNote('${n.id}')">Hapus</button>
      </div>
    </div>`
  ).join('');
}

// ---- VIEWS ----
function setView(view, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  document.querySelectorAll('.board-view, .list-view').forEach(v => v.classList.add('hidden'));

  const map = {
    dashboard: 'view-dashboard',
    all:        'view-all',
    inprogress: 'view-inprogress',
    done:       'view-done',
    notes:      'view-notes',
  };

  const labels = {
    dashboard:  'Dashboard',
    all:        'All Tasks',
    inprogress: 'In Progress',
    done:       'Completed',
    notes:      'Notes / Resources',
  };

  currentView = view;
  document.getElementById(map[view]).classList.remove('hidden');
  document.getElementById('page-title').textContent = labels[view] || 'Dashboard';
  renderAll();
  return false;
}

// ---- DRAG & DROP ----
function dragStart(e, id) {
  draggedId = id;
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function dragEnd(e) {
  e.target.classList.remove('dragging');
  draggedId = null;
}

function dragOver(e) { e.preventDefault(); }

function dragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function drop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-over');
  if (!draggedId) return;
  const newStatus = col.dataset.status;
  const task = tasks.find(t => t.id === draggedId);
  if (task && task.status !== newStatus) {
    task.status = newStatus;
    save();
    renderAll();
  }
}

// ---- TASK MODAL ----
function openTaskModal(id, defaultStatus) {
  editingTaskId = id || null;
  const modal  = document.getElementById('taskModalOverlay');
  const title  = document.getElementById('taskModalTitle');

  if (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    title.textContent = 'Edit Task';
    document.getElementById('taskId').value       = task.id;
    document.getElementById('taskTitle').value    = task.title;
    document.getElementById('taskDesc').value     = task.desc || '';
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskStatus').value   = task.status;
    document.getElementById('taskLink').value     = task.link || '';
  } else {
    title.textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    if (defaultStatus) document.getElementById('taskStatus').value = defaultStatus;
  }

  modal.classList.remove('hidden');
  document.getElementById('taskTitle').focus();
}

function saveTask(e) {
  e.preventDefault();
  const id       = document.getElementById('taskId').value;
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const status   = document.getElementById('taskStatus').value;
  const link     = document.getElementById('taskLink').value.trim();

  if (!title) return;

  if (id) {
    const task = tasks.find(t => t.id === id);
    if (task) Object.assign(task, { title, desc, priority, status, link });
  } else {
    tasks.push({ id: uid(), title, desc, priority, status, link, createdAt: Date.now() });
  }

  save();
  renderAll();
  closeModal('taskModal');
}

// ---- DETAIL MODAL ----
function openDetail(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('detailTitle').textContent = task.title;

  const statusLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
  document.getElementById('detailMeta').innerHTML = `
    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
    <span class="list-card-status status-${task.status}">${statusLabel[task.status]}</span>
  `;

  document.getElementById('detailDesc').textContent = task.desc || '(Tidak ada deskripsi)';

  const actions = [];
  if (task.link) {
    actions.push(`<a class="btn-detail-action btn-move" href="${task.link}" target="_blank" rel="noopener noreferrer">Buka Dokumentasi ↗</a>`);
  }
  if (task.status !== 'inprogress') {
    actions.push(`<button class="btn-detail-action btn-move" onclick="moveTask('${task.id}','inprogress')">Tandai In Progress</button>`);
  }
  if (task.status !== 'done') {
    actions.push(`<button class="btn-detail-action btn-move" onclick="moveTask('${task.id}','done')">Tandai Done ✓</button>`);
  }
  if (task.status !== 'todo') {
    actions.push(`<button class="btn-detail-action btn-edit" onclick="moveTask('${task.id}','todo')">Kembalikan ke To Do</button>`);
  }
  actions.push(`<button class="btn-detail-action btn-edit" onclick="closeModal('detailModal'); openTaskModal('${task.id}')">Edit Task</button>`);
  actions.push(`<button class="btn-detail-action btn-delete" onclick="deleteTask('${task.id}')">Hapus</button>`);
  document.getElementById('detailActions').innerHTML = actions.join('');

  document.getElementById('detailModalOverlay').classList.remove('hidden');
}

function moveTask(id, newStatus) {
  const task = tasks.find(t => t.id === id);
  if (task) { task.status = newStatus; save(); renderAll(); }
  closeModal('detailModal');
}

function deleteTask(id) {
  if (!confirm('Hapus task ini?')) return;
  tasks = tasks.filter(t => t.id !== id);
  save();
  renderAll();
  closeModal('detailModal');
}

// ---- NOTE MODAL ----
function openNoteModal() {
  document.getElementById('noteForm').reset();
  document.getElementById('noteId').value = '';
  document.getElementById('noteModalOverlay').classList.remove('hidden');
  document.getElementById('noteTitle').focus();
}

function saveNote(e) {
  e.preventDefault();
  const title    = document.getElementById('noteTitle').value.trim();
  const link     = document.getElementById('noteLink').value.trim();
  const desc     = document.getElementById('noteDesc').value.trim();
  const category = document.getElementById('noteCategory').value;

  if (!title || !link) return;

  notes.push({ id: uid(), title, link, desc, category });
  save();
  renderAll();
  closeModal('noteModal');
}

function deleteNote(id) {
  if (!confirm('Hapus note ini?')) return;
  notes = notes.filter(n => n.id !== id);
  save();
  renderNotes();
}

// ---- MODAL CLOSE ----
function closeModal(modalId, overlay) {
  if (overlay && overlay.id !== modalId + 'Overlay') return;
  document.getElementById(modalId + 'Overlay').classList.add('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['taskModal','detailModal','noteModal'].forEach(m => {
      document.getElementById(m + 'Overlay').classList.add('hidden');
    });
  }
});

// ---- ESCAPE HTML ----
// ---- ESCAPE HTML ----
function escHtml(str) {
  return (str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ---- CLOUD STORAGE ----
async function loadDataFromCloud() {
  try {
    const doc = await db.collection("learning_data").doc("user_1").get();
    if (doc.exists) {
      const data = doc.data();
      tasks = data.tasks || [];
      notes = data.notes || [];
      console.log("✓ Data dimuat dari Cloud");
    }
    // Setelah data dari cloud diambil (atau gagal), baru gambar UI-nya
    renderAll(); 
  } catch (error) {
    console.log("Error loading cloud data:", error);
    renderAll();
  }
}

// Jalankan fungsi load
loadDataFromCloud();
