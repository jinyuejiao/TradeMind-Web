const API_BASE = 'http://localhost:3000/api';
let customers = [];
let orders = [];

document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();
    loadOrders();
    initEventListeners();
});

async function loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/orders`);
        const result = await res.json();
        if (result.success) {
            orders = result.orders || [];
        }
    } catch (e) {
        console.error('加载订单失败:', e);
    }
}

async function loadCustomers() {
    try {
        const res = await fetch(`${API_BASE}/customers`);
        const result = await res.json();
        if (result.success) {
            customers = result.customers || [];
            renderCustomers();
        }
    } catch (error) {
        console.error('加载客户失败:', error);
        document.getElementById('customersList').innerHTML = '<p class="col-span-3 text-center text-red-500 py-8">加载客户失败</p>';
    }
}

function initEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterCustomers);
    document.getElementById('styleFilter').addEventListener('change', filterCustomers);
    document.getElementById('customerForm').addEventListener('submit', saveCustomer);
    
    document.getElementById('customerModal').addEventListener('click', (e) => {
        if (e.target.id === 'customerModal') closeCustomerModal();
    });
    
    document.getElementById('customerDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'customerDetailModal') closeCustomerDetailModal();
    });
}

function filterCustomers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const style = document.getElementById('styleFilter').value;
    
    const filtered = customers.filter(customer => {
        const matchSearch = !search || 
            (customer.nickname && customer.nickname.toLowerCase().includes(search));
        const matchStyle = !style || customer.chat_style === style;
        return matchSearch && matchStyle;
    });
    
    renderCustomers(filtered);
}

function renderCustomers(customersToRender = customers) {
    const container = document.getElementById('customersList');
    const emptyState = document.getElementById('emptyState');
    
    if (customersToRender.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = customersToRender.map(customer => {
        const orderCount = orders.filter(o => 
            o.order_0_customer_nickname === customer.nickname
        ).length;
        
        const styleColors = {
            '简洁直接型': 'bg-blue-100 text-blue-700',
            '咨询细致型': 'bg-purple-100 text-purple-700',
            '砍价议价型': 'bg-orange-100 text-orange-700',
            '闲聊熟客型': 'bg-green-100 text-green-700',
            '其他': 'bg-slate-100 text-slate-700'
        };
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition cursor-pointer" onclick="showCustomerDetail('${customer.id}')">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                            <span class="text-brand-600 font-bold text-lg">${(customer.nickname || '未知').charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800">${customer.nickname || '未知'}</h3>
                            <p class="text-sm text-slate-500">${customer.email || '暂无邮箱'}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${styleColors[customer.chat_style] || 'bg-slate-100 text-slate-700'}">${customer.chat_style || '未分类'}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                    <span class="text-slate-500">订单数：<span class="font-medium text-slate-800">${orderCount}</span></span>
                    <span class="text-slate-500">创建：<span class="font-medium text-slate-800">${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('zh-CN') : '-'}</span></span>
                </div>
            </div>
        `;
    }).join('');
}

function openAddCustomerModal() {
    document.getElementById('modalTitle').textContent = '新增客户';
    document.getElementById('customerId').value = '';
    document.getElementById('customerNickname').value = '';
    document.getElementById('customerChatStyle').value = '简洁直接型';
    document.getElementById('customerEmail').value = '';
    document.getElementById('customerOtherInfo').value = '';
    document.getElementById('customerModal').classList.remove('hidden');
    document.getElementById('customerModal').classList.add('flex');
}

function openEditCustomerModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    document.getElementById('modalTitle').textContent = '编辑客户';
    document.getElementById('customerId').value = customer.id;
    document.getElementById('customerNickname').value = customer.nickname || '';
    document.getElementById('customerChatStyle').value = customer.chat_style || '简洁直接型';
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerOtherInfo').value = customer.other_info || '';
    document.getElementById('customerModal').classList.remove('hidden');
    document.getElementById('customerModal').classList.add('flex');
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.add('hidden');
    document.getElementById('customerModal').classList.remove('flex');
}

async function saveCustomer(e) {
    e.preventDefault();
    
    const customerId = document.getElementById('customerId').value;
    const data = {
        nickname: document.getElementById('customerNickname').value,
        chat_style: document.getElementById('customerChatStyle').value,
        email: document.getElementById('customerEmail').value,
        other_info: document.getElementById('customerOtherInfo').value
    };
    
    try {
        let res, result;
        if (customerId) {
            res = await fetch(`${API_BASE}/customers/${customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            res = await fetch(`${API_BASE}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        result = await res.json();
        
        if (result.success) {
            closeCustomerModal();
            loadCustomers();
        } else {
            alert('保存失败: ' + result.error);
        }
    } catch (error) {
        console.error('保存客户失败:', error);
        alert('保存失败: ' + error.message);
    }
}

async function showCustomerDetail(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    
    const modal = document.getElementById('customerDetailModal');
    const content = document.getElementById('customerDetailContent');
    const ordersList = document.getElementById('customerOrdersList');
    
    const customerOrders = orders.filter(o => 
        o.order_0_customer_nickname === customer.nickname
    );
    
    const styleColors = {
        '简洁直接型': 'bg-blue-100 text-blue-700',
        '咨询细致型': 'bg-purple-100 text-purple-700',
        '砍价议价型': 'bg-orange-100 text-orange-700',
        '闲聊熟客型': 'bg-green-100 text-green-700',
        '其他': 'bg-slate-100 text-slate-700'
    };
    
    content.innerHTML = `
        <div class="flex items-center space-x-4 mb-6">
            <div class="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
                <span class="text-brand-600 font-bold text-2xl">${(customer.nickname || '未知').charAt(0).toUpperCase()}</span>
            </div>
            <div>
                <h3 class="text-xl font-bold text-slate-800">${customer.nickname || '未知'}</h3>
                <span class="px-3 py-1 rounded-full text-sm font-medium ${styleColors[customer.chat_style] || 'bg-slate-100 text-slate-700'}">${customer.chat_style || '未分类'}</span>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <p class="text-sm text-slate-500">邮箱</p>
                <p class="font-medium">${customer.email || '暂无'}</p>
            </div>
            <div>
                <p class="text-sm text-slate-500">创建时间</p>
                <p class="font-medium">${customer.createdAt ? new Date(customer.createdAt).toLocaleString('zh-CN') : '-'}</p>
            </div>
            <div class="col-span-2">
                <p class="text-sm text-slate-500">其他信息</p>
                <p class="font-medium">${customer.other_info || '无'}</p>
            </div>
        </div>
    `;
    
    if (customerOrders.length === 0) {
        ordersList.innerHTML = '<p class="text-slate-500 text-center py-4">该客户暂无订单记录</p>';
    } else {
        ordersList.innerHTML = customerOrders.map(order => {
            const statusClass = getStatusClass(order.order_0_order_status || '待确认');
            return `
                <div class="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                        <p class="font-medium text-slate-800">${order.order_0_product_name || '未明确产品'}</p>
                        <p class="text-sm text-slate-500">${order.id}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">${order.order_0_order_status || '待确认'}</span>
                </div>
            `;
        }).join('');
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCustomerDetailModal() {
    document.getElementById('customerDetailModal').classList.add('hidden');
    document.getElementById('customerDetailModal').classList.remove('flex');
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
