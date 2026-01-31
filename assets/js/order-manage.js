const API_BASE = 'http://localhost:3000/api';
let orders = [];
let progressConfig = [];

document.addEventListener('DOMContentLoaded', function() {
    loadOrders();
    loadProgressConfig();
    initEventListeners();
});

async function loadProgressConfig() {
    try {
        const res = await fetch(`${API_BASE}/progress-config`);
        const result = await res.json();
        if (result.success) {
            progressConfig = result.config;
        }
    } catch (e) {
        console.error('加载进度配置失败:', e);
    }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders`);
        const result = await res.json();
        if (result.success) {
            orders = result.orders || [];
            renderOrders();
        }
    } catch (error) {
        console.error('加载订单失败:', error);
        document.getElementById('ordersList').innerHTML = '<p class="text-center text-red-500 py-8">加载订单失败</p>';
    }
}

function initEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterOrders);
    document.getElementById('statusFilter').addEventListener('change', filterOrders);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('closeModalBtn2').addEventListener('click', closeModal);
    
    document.getElementById('orderDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'orderDetailModal') closeModal();
    });
}

function filterOrders() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    
    const filtered = orders.filter(order => {
        const matchSearch = !search || 
            (order.id && order.id.toLowerCase().includes(search)) ||
            (order.order_0_customer_nickname && order.order_0_customer_nickname.toLowerCase().includes(search));
        const matchStatus = !status || order.order_0_order_status === status;
        return matchSearch && matchStatus;
    });
    
    renderOrders(filtered);
}

function renderOrders(ordersToRender = orders) {
    const container = document.getElementById('ordersList');
    const emptyState = document.getElementById('emptyState');
    
    if (ordersToRender.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = ordersToRender.map(order => {
        const statusClass = getStatusClass(order.order_0_order_status || '待确认');
        const statusText = order.order_0_order_status || '待确认';
        const customer = order.order_0_customer_nickname || '未知客户';
        const product = order.order_0_product_name || '未明确产品';
        const quantity = order.order_0_quantity || '-';
        const price = order.order_0_unit_price || '-';
        const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-';
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onclick="showOrderDetail('${order.id}')">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <span class="font-mono text-sm text-slate-500">${order.id || '-'}</span>
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${statusClass}">${statusText}</span>
                    </div>
                    <span class="text-sm text-slate-400">${createdAt}</span>
                </div>
                <div class="grid grid-cols-4 gap-4">
                    <div>
                        <p class="text-sm text-slate-500 mb-1">客户</p>
                        <p class="font-medium text-slate-800">${customer}</p>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 mb-1">产品</p>
                        <p class="font-medium text-slate-800">${product}</p>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 mb-1">数量</p>
                        <p class="font-medium text-slate-800">${quantity}</p>
                    </div>
                    <div>
                        <p class="text-sm text-slate-500 mb-1">单价</p>
                        <p class="font-medium text-slate-800">${price}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const classes = {
        '待确认': 'bg-yellow-100 text-yellow-700',
        '已确认': 'bg-blue-100 text-blue-700',
        '已付款': 'bg-purple-100 text-purple-700',
        '已发货': 'bg-orange-100 text-orange-700',
        '已完成': 'bg-green-100 text-green-700'
    };
    return classes[status] || 'bg-slate-100 text-slate-700';
}

async function showOrderDetail(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    const customer = order.order_0_customer_nickname || '未知';
    const product = order.order_0_product_name || '未明确';
    const quantity = order.order_0_quantity || '-';
    const price = order.order_0_unit_price || '-';
    const delivery = order.order_0_delivery_date || '-';
    const status = order.order_0_order_status || '待确认';
    
    let orderInfoHtml = '';
    if (order.order_info) {
        const ordersInfo = Array.isArray(order.order_info) ? order.order_info : [order.order_info];
        orderInfoHtml = ordersInfo.map((o, i) => `
            <div class="bg-slate-50 rounded-lg p-4">
                <h4 class="font-bold text-slate-800 mb-3">订单信息 ${i + 1}</h4>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-slate-500">客户昵称：</span>${o.customer_nickname || '-'}</div>
                    <div><span class="text-slate-500">商品名称：</span>${o.product_name || '-'}</div>
                    <div><span class="text-slate-500">单价：</span>${o.unit_price || '-'}</div>
                    <div><span class="text-slate-500">数量：</span>${o.quantity || '-'}</div>
                    <div><span class="text-slate-500">交货日期：</span>${o.delivery_date || '-'}</div>
                    <div><span class="text-slate-500">订单状态：</span><span class="text-brand-600 font-medium">${o.order_status || '待确认'}</span></div>
                </div>
            </div>
        `).join('');
    }
    
    let customerInfoHtml = '';
    if (order.customer_info) {
        const customers = Array.isArray(order.customer_info) ? order.customer_info : [order.customer_info];
        customerInfoHtml = customers.map((c, i) => `
            <div class="bg-slate-50 rounded-lg p-4 mt-4">
                <h4 class="font-bold text-slate-800 mb-3">客户信息 ${i + 1}</h4>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-slate-500">客户昵称：</span>${c.nickname || '-'}</div>
                    <div><span class="text-slate-500">沟通风格：</span>${c.chat_style || '-'}</div>
                    <div class="col-span-2"><span class="text-slate-500">其他信息：</span>${c.other_info || '-'}</div>
                </div>
            </div>
        `).join('');
    }
    
    let productInfoHtml = '';
    if (order.product_info) {
        const products = Array.isArray(order.product_info) ? order.product_info : [order.product_info];
        productInfoHtml = products.map((p, i) => `
            <div class="bg-slate-50 rounded-lg p-4 mt-4">
                <h4 class="font-bold text-slate-800 mb-3">产品信息 ${i + 1}</h4>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-slate-500">产品名称：</span>${p.product_name || '-'}</div>
                    <div><span class="text-slate-500">数量：</span>${p.quantity || '-'}</div>
                    <div><span class="text-slate-500">货号/型号：</span>${p.product_code || '-'}</div>
                    <div><span class="text-slate-500">库存影响：</span>${p.stock_impact || '-'}</div>
                    <div class="col-span-2"><span class="text-slate-500">供应商操作：</span>${p.supplier_action || '-'}</div>
                </div>
            </div>
        `).join('');
    }
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-slate-500">订单号</p>
                    <p class="font-mono font-medium">${order.id}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">当前状态</p>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusClass(status)}">${status}</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-slate-500">客户</p>
                    <p class="font-medium">${customer}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">产品</p>
                    <p class="font-medium">${product}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">数量</p>
                    <p class="font-medium">${quantity}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">单价</p>
                    <p class="font-medium">${price}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">交货日期</p>
                    <p class="font-medium">${delivery}</p>
                </div>
                <div>
                    <p class="text-sm text-slate-500">创建时间</p>
                    <p class="font-medium">${order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-'}</p>
                </div>
            </div>
            ${orderInfoHtml}
            ${customerInfoHtml}
            ${productInfoHtml}
        </div>
    `;
    
    renderProgressTimeline(order, status);
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderProgressTimeline(order, currentStatus) {
    const timeline = document.getElementById('progressTimeline');
    const actions = document.getElementById('progressActions');
    
    const statuses = progressConfig.length > 0 ? 
        progressConfig.map(p => p.name) : 
        ['待确认', '已确认', '已付款', '已发货', '已完成'];
    
    const currentIndex = statuses.indexOf(currentStatus);
    
    timeline.innerHTML = statuses.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        
        return `
            <div class="progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} flex-1 text-center">
                <div class="step-circle w-8 h-8 rounded-full border-2 border-slate-300 mx-auto flex items-center justify-center mb-2 bg-white relative">
                    ${isCompleted ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="white" d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69L218.34 66.34a8 8 0 0 1 11.32 11.32Z"></path></svg>` : ''}
                </div>
                <p class="text-xs font-medium ${isCompleted || isActive ? 'text-slate-800' : 'text-slate-400'}">${status}</p>
                ${index < statuses.length - 1 ? `<div class="step-line absolute h-0.5 bg-slate-200 w-full left-1/2 top-4"></div>` : ''}
            </div>
        `;
    }).join('');
    
    let html = '';
    const statusFlow = {
        '待确认': ['已确认', '已付款'],
        '已确认': ['已付款', '已发货'],
        '已付款': ['已发货', '已完成'],
        '已发货': ['已完成'],
        '已完成': []
    };
    
    const availableTransitions = statusFlow[currentStatus] || [];
    availableTransitions.forEach(nextStatus => {
        html += `<button onclick="updateOrderStatus('${order.id}', '${nextStatus}')" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">转为${nextStatus}</button>`;
    });
    
    actions.innerHTML = html;
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await res.json();
        if (result.success) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                order.order_0_order_status = newStatus;
            }
            showOrderDetail(orderId);
            renderOrders();
        } else {
            alert('更新状态失败: ' + result.error);
        }
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新状态失败: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('orderDetailModal').classList.add('hidden');
    document.getElementById('orderDetailModal').classList.remove('flex');
}
