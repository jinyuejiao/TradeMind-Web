const API_BASE = 'http://localhost:3000/api';
let progressConfig = [];

document.addEventListener('DOMContentLoaded', function() {
    loadProgressConfig();
    initEventListeners();
});

async function loadProgressConfig() {
    try {
        const res = await fetch(`${API_BASE}/progress-config`);
        const result = await res.json();
        if (result.success) {
            progressConfig = result.config;
            renderProgressList();
            renderPreview();
        }
    } catch (error) {
        console.error('加载进度配置失败:', error);
    }
}

function initEventListeners() {
    document.getElementById('stepForm').addEventListener('submit', saveStep);
    
    document.getElementById('addStepModal').addEventListener('click', (e) => {
        if (e.target.id === 'addStepModal') closeAddStepModal();
    });
}

function renderProgressList() {
    const container = document.getElementById('progressList');
    
    if (progressConfig.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <p>暂无进度节点配置</p>
                <p class="text-sm mt-2">点击"新增节点"添加订单进度跟踪节点</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = progressConfig.map((step, index) => {
        const isFirst = index === 0;
        const isLast = index === progressConfig.length - 1;
        
        return `
            <div class="flex items-center space-x-3 bg-slate-50 rounded-lg p-3 sortable-item" draggable="true" data-index="${index}">
                <div class="cursor-grab text-slate-400 hover:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">
                        <path fill="currentColor" d="M96 80a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm0-48a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm48 48a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm-48 0a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm48 48a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm0-48a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm-48 0a16 16 0 1 0-16-16a16 16 0 0 0 16 16Zm48 48a16 16 0 1 0-16-16a16 16 0 0 0 16 16Z"></path>
                    </svg>
                </div>
                <div class="flex items-center justify-between flex-1">
                    <div class="flex items-center space-x-3">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${step.color || '#14B8A6'}"></div>
                        <span class="font-medium text-slate-800">${step.name}</span>
                        <span class="text-sm text-slate-500">${step.description || ''}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs text-slate-400">位置 ${index + 1}</span>
                        <button onclick="editStep('${step.id}')" class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                                <path fill="currentColor" d="M216 96a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm-72 16a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm96 0a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm-72 8a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm-40 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Zm80 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Zm-40 8a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm-40 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Zm80 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Zm-40 8a16 16 0 1 1-16-16a16 16 0 0 1 16 16Zm-40 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Zm80 0a16 16 0 1 0 16 16a16 16 0 0 0-16-16Z"></path>
                            </svg>
                        </button>
                        <button onclick="deleteStep('${step.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256">
                                <path fill="currentColor" d="M96 96a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32a16 16 0 0 1-16-16V96Zm112 0a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32a16 16 0 0 1-16-16V96Zm-56 48a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32a16 16 0 0 1-16-16V144Zm-56 0a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32a16 16 0 0 1-16-16V144Zm112 0a16 16 0 0 1 16-16h32a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16h-32a16 16 0 0 1-16-16V144Z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    initDragAndDrop();
}

function initDragAndDrop() {
    const items = document.querySelectorAll('.sortable-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('opacity-50');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        const [removed] = progressConfig.splice(fromIndex, 1);
        progressConfig.splice(toIndex, 0, removed);
        
        saveProgressConfig();
        renderProgressList();
        renderPreview();
    }
}

function handleDragEnd() {
    this.classList.remove('opacity-50');
    document.querySelectorAll('.sortable-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function renderPreview() {
    const container = document.getElementById('previewTimeline');
    
    if (progressConfig.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center w-full">添加节点后将在此预览</p>';
        return;
    }
    
    container.innerHTML = progressConfig.map((step, index) => {
        const isLast = index === progressConfig.length - 1;
        const color = step.color || '#14B8A6';
        
        return `
            <div class="flex items-center flex-1 ${isLast ? '' : ''}">
                <div class="text-center flex-1">
                    <div class="w-10 h-10 rounded-full border-2 border-current mx-auto mb-2 flex items-center justify-center" style="color: ${color}; border-color: ${color}">
                        <span class="text-sm font-bold">${index + 1}</span>
                    </div>
                    <p class="text-xs font-medium text-slate-700">${step.name}</p>
                </div>
                ${isLast ? '' : `<div class="flex-1 h-0.5 mx-2" style="background: linear-gradient(90deg, ${color} 0%, #E2E8F0 100%);"></div>`}
            </div>
        `;
    }).join('');
}

function openAddStepModal() {
    document.getElementById('stepModalTitle').textContent = '新增进度节点';
    document.getElementById('stepId').value = '';
    document.getElementById('stepName').value = '';
    document.getElementById('stepDescription').value = '';
    document.querySelector('input[name="stepColor"][value="#F59E0B"]').checked = true;
    document.getElementById('addStepModal').classList.remove('hidden');
    document.getElementById('addStepModal').classList.add('flex');
}

function editStep(stepId) {
    const step = progressConfig.find(s => s.id === stepId);
    if (!step) return;
    
    document.getElementById('stepModalTitle').textContent = '编辑进度节点';
    document.getElementById('stepId').value = step.id;
    document.getElementById('stepName').value = step.name;
    document.getElementById('stepDescription').value = step.description || '';
    
    const colorRadio = document.querySelector(`input[name="stepColor"][value="${step.color}"]`);
    if (colorRadio) {
        colorRadio.checked = true;
    }
    
    document.getElementById('addStepModal').classList.remove('hidden');
    document.getElementById('addStepModal').classList.add('flex');
}

function closeAddStepModal() {
    document.getElementById('addStepModal').classList.add('hidden');
    document.getElementById('addStepModal').classList.remove('flex');
}

async function saveStep(e) {
    e.preventDefault();
    
    const stepId = document.getElementById('stepId').value;
    const data = {
        name: document.getElementById('stepName').value,
        description: document.getElementById('stepDescription').value,
        color: document.querySelector('input[name="stepColor"]:checked').value
    };
    
    try {
        let res, result;
        if (stepId) {
            res = await fetch(`${API_BASE}/progress-config/${stepId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            data.id = 'step-' + Date.now();
            res = await fetch(`${API_BASE}/progress-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        result = await res.json();
        
        if (result.success) {
            closeAddStepModal();
            loadProgressConfig();
        } else {
            alert('保存失败: ' + result.error);
        }
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
    }
}

async function deleteStep(stepId) {
    if (!confirm('确定要删除此进度节点吗？')) return;
    
    try {
        const res = await fetch(`${API_BASE}/progress-config/${stepId}`, {
            method: 'DELETE'
        });
        
        const result = await res.json();
        
        if (result.success) {
            loadProgressConfig();
        } else {
            alert('删除失败: ' + result.error);
        }
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error.message);
    }
}

async function saveProgressConfig() {
    try {
        await fetch(`${API_BASE}/progress-config/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: progressConfig })
        });
    } catch (error) {
        console.error('保存顺序失败:', error);
    }
}
