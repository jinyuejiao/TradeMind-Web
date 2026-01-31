const API_BASE = 'http://localhost:8080/api';
let selectedFile = null;
let analyzedData = null;

document.addEventListener('DOMContentLoaded', function() {
    initUpload();
    initEventListeners();
});

function initUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-brand-500', 'bg-brand-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-brand-500', 'bg-brand-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-brand-500', 'bg-brand-50');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    document.getElementById('removeImage').addEventListener('click', removeImage);
    document.getElementById('uploadBtn').addEventListener('click', uploadImage);
    document.getElementById('cancelBtn').addEventListener('click', cancelConfirm);
    document.getElementById('confirmBtn').addEventListener('click', confirmAndSave);
}

function handleFileSelect(file) {
    if (file.size > 10 * 1024 * 1024) {
        alert('文件大小不能超过10MB');
        return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('previewContainer').classList.remove('hidden');
        document.getElementById('dropZone').classList.add('hidden');
        document.getElementById('uploadBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    analyzedData = null;
    document.getElementById('previewImage').src = '';
    document.getElementById('previewContainer').classList.add('hidden');
    document.getElementById('dropZone').classList.remove('hidden');
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('resultContainer').classList.add('hidden');
    document.getElementById('confirmContainer').classList.add('hidden');
    document.getElementById('actionResult').classList.add('hidden');
}

function initEventListeners() {
    document.getElementById('cancelBtn').addEventListener('click', () => {
        document.getElementById('confirmContainer').classList.add('hidden');
    });
}

async function uploadImage() {
    if (!selectedFile) return;

    const uploadBtn = document.getElementById('uploadBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');
    const uploadLoading = document.getElementById('uploadLoading');

    uploadBtn.disabled = true;
    uploadBtnText.classList.add('hidden');
    uploadLoading.classList.remove('hidden');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            analyzedData = result.data;
            displayResult(result.data);
        } else {
            alert('识别失败: ' + (result.error || '未知错误'));
        }
    } catch (error) {
        console.error('上传错误:', error);
        alert('上传失败: ' + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtnText.classList.remove('hidden');
        uploadLoading.classList.add('hidden');
    }
}

function displayResult(data) {
    const container = document.getElementById('resultContainer');
    const content = document.getElementById('resultContent');
    
    let html = '';

    if (data.order_info) {
        const orders = Array.isArray(data.order_info) ? data.order_info : [data.order_info];
        orders.forEach((order, index) => {
            html += `
                <div class="border border-slate-200 rounded-lg p-4">
                    <h4 class="font-bold text-slate-800 mb-3 flex items-center">
                        <span class="bg-brand-100 text-brand-700 text-xs px-2 py-1 rounded mr-2">订单 ${index + 1}</span>
                        ${order.customer_nickname || '未识别'}
                    </h4>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-slate-500">商品名称：</span><span class="font-medium">${order.product_name || '未明确'}</span></div>
                        <div><span class="text-slate-500">单价：</span><span class="font-medium">${order.unit_price || '未明确'}</span></div>
                        <div><span class="text-slate-500">数量：</span><span class="font-medium">${order.quantity || '未明确'}</span></div>
                        <div><span class="text-slate-500">交货日期：</span><span class="font-medium">${order.delivery_date || '未明确'}</span></div>
                        <div><span class="text-slate-500">订单状态：</span><span class="font-medium text-brand-600">${order.order_status || '待确认'}</span></div>
                    </div>
                </div>
            `;
        });
    }

    if (data.customer_info) {
        const customers = Array.isArray(data.customer_info) ? data.customer_info : [data.customer_info];
        customers.forEach((customer, index) => {
            html += `
                <div class="border border-slate-200 rounded-lg p-4 mt-4">
                    <h4 class="font-bold text-slate-800 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="text-brand-600 mr-2">
                            <path fill="currentColor" d="M231.89 212.37A15.89 15.89 0 0 1 216 224h-80a16 16 0 0 1-15.89-13.63A44 44 0 0 1 75.89 158a15.89 15.89 0 0 1 13.58-19.61a16.08 16.08 0 0 1 18.67 4.82a43.86 43.86 0 0 1 29.68 0a16 16 0 0 1 18.67-4.82a15.89 15.89 0 0 1 13.58 19.61a44 44 0 0 1-44.23 52.37a15.89 15.89 0 0 1 15.89-17.63h80a16 16 0 0 1 15.89 17.63Z"></path>
                        </svg>
                        客户信息 ${index + 1}
                    </h4>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-slate-500">客户昵称：</span><span class="font-medium">${customer.nickname || '未识别'}</span></div>
                        <div><span class="text-slate-500">沟通风格：</span><span class="font-medium">${customer.chat_style || '未明确'}</span></div>
                        <div class="col-span-2"><span class="text-slate-500">其他信息：</span><span class="font-medium">${customer.other_info || '无'}</span></div>
                    </div>
                </div>
            `;
        });
    }

    if (data.product_info) {
        const products = Array.isArray(data.product_info) ? data.product_info : [data.product_info];
        products.forEach((product, index) => {
            html += `
                <div class="border border-slate-200 rounded-lg p-4 mt-4">
                    <h4 class="font-bold text-slate-800 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="text-brand-600 mr-2">
                            <path fill="currentColor" d="M208 80h-24V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16Zm-80 0v24a8 8 0 0 1-16 0V80a8 8 0 0 1 16 0Zm80 128H48V96h160v112Zm-48-64a32 32 0 1 1-32 32a32 32 0 0 1 32-32Z"></path>
                        </svg>
                        产品信息 ${index + 1}
                    </h4>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-slate-500">产品名称：</span><span class="font-medium">${product.product_name || '未明确'}</span></div>
                        <div><span class="text-slate-500">数量：</span><span class="font-medium">${product.quantity || '未明确'}</span></div>
                        <div><span class="text-slate-500">货号/型号：</span><span class="font-medium">${product.product_code || '未明确'}</span></div>
                        <div><span class="text-slate-500">库存影响：</span><span class="font-medium text-brand-600">${product.stock_impact || '需扣减库存'}</span></div>
                        <div class="col-span-2"><span class="text-slate-500">供应商操作：</span><span class="font-medium text-brand-600">${product.supplier_action || '需向对应供应商下单'}</span></div>
                    </div>
                </div>
            `;
        });
    }

    content.innerHTML = html || '<p class="text-slate-500 text-center py-8">未识别到有效信息</p>';
    container.classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('confirmContainer').classList.remove('hidden');
        generateConfirmForm(data);
    }, 500);
}

function generateConfirmForm(data) {
    const form = document.getElementById('confirmForm');
    let html = `
        <p class="text-sm text-slate-600 mb-4">请核对以下信息，确认无误后点击"确认并保存"</p>
        <div class="space-y-3">
    `;

    const orders = data.order_info ? (Array.isArray(data.order_info) ? data.order_info : [data.order_info]) : [];
    const customers = data.customer_info ? (Array.isArray(data.customer_info) ? data.customer_info : [data.customer_info]) : [];
    const products = data.product_info ? (Array.isArray(data.product_info) ? data.product_info : [data.product_info]) : [];

    orders.forEach((order, i) => {
        html += `
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p class="font-bold text-slate-800 mb-2">订单 ${i + 1}</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="col-span-2">
                        <label class="text-slate-500">客户昵称</label>
                        <input type="text" name="order_${i}_customer_nickname" value="${order.customer_nickname || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">商品名称</label>
                        <input type="text" name="order_${i}_product_name" value="${order.product_name || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">单价</label>
                        <input type="text" name="order_${i}_unit_price" value="${order.unit_price || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">数量</label>
                        <input type="number" name="order_${i}_quantity" value="${order.quantity || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">交货日期</label>
                        <input type="text" name="order_${i}_delivery_date" value="${order.delivery_date || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">订单状态</label>
                        <select name="order_${i}_order_status" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                            <option value="待确认" ${order.order_status === '待确认' ? 'selected' : ''}>待确认</option>
                            <option value="已确认" ${order.order_status === '已确认' ? 'selected' : ''}>已确认</option>
                            <option value="已付款" ${order.order_status === '已付款' ? 'selected' : ''}>已付款</option>
                            <option value="已发货" ${order.order_status === '已发货' ? 'selected' : ''}>已发货</option>
                            <option value="已完成" ${order.order_status === '已完成' ? 'selected' : ''}>已完成</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    });

    customers.forEach((customer, i) => {
        html += `
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p class="font-bold text-slate-800 mb-2">客户 ${i + 1}</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div class="col-span-2">
                        <label class="text-slate-500">客户昵称</label>
                        <input type="text" name="customer_${i}_nickname" value="${customer.nickname || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">沟通风格</label>
                        <select name="customer_${i}_chat_style" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                            <option value="简洁直接型" ${customer.chat_style === '简洁直接型' ? 'selected' : ''}>简洁直接型</option>
                            <option value="咨询细致型" ${customer.chat_style === '咨询细致型' ? 'selected' : ''}>咨询细致型</option>
                            <option value="砍价议价型" ${customer.chat_style === '砍价议价型' ? 'selected' : ''}>砍价议价型</option>
                            <option value="闲聊熟客型" ${customer.chat_style === '闲聊熟客型' ? 'selected' : ''}>闲聊熟客型</option>
                            <option value="其他" ${customer.chat_style === '其他' ? 'selected' : ''}>其他</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-slate-500">邮箱</label>
                        <input type="email" name="customer_${i}_email" value="${customer.email || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div class="col-span-2">
                        <label class="text-slate-500">其他信息</label>
                        <textarea name="customer_${i}_other_info" class="w-full px-3 py-2 border border-slate-200 rounded mt-1" rows="2">${customer.other_info || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    });

    products.forEach((product, i) => {
        html += `
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p class="font-bold text-slate-800 mb-2">产品 ${i + 1}</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <label class="text-slate-500">产品名称</label>
                        <input type="text" name="product_${i}_product_name" value="${product.product_name || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">数量</label>
                        <input type="number" name="product_${i}_quantity" value="${product.quantity || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">货号/型号</label>
                        <input type="text" name="product_${i}_product_code" value="${product.product_code || ''}" class="w-full px-3 py-2 border border-slate-200 rounded mt-1">
                    </div>
                    <div>
                        <label class="text-slate-500">库存影响</label>
                        <input type="text" value="${product.stock_impact || '需扣减库存'}" disabled class="w-full px-3 py-2 border border-slate-200 rounded mt-1 bg-slate-100">
                    </div>
                    <div class="col-span-2">
                        <label class="text-slate-500">供应商操作</label>
                        <input type="text" value="${product.supplier_action || '需向对应供应商下单'}" disabled class="w-full px-3 py-2 border border-slate-200 rounded mt-1 bg-slate-100">
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    form.innerHTML = html;
}

function cancelConfirm() {
    document.getElementById('confirmContainer').classList.add('hidden');
}

async function confirmAndSave() {
    const form = document.getElementById('confirmForm');
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
        data[key] = value;
    });

    try {
        const customerInfo = analyzedData.customer_info ? (Array.isArray(analyzedData.customer_info) ? analyzedData.customer_info[0] : analyzedData.customer_info) : null;
        if (customerInfo && customerInfo.nickname) {
            const customerRes = await fetch(`${API_BASE}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: customerInfo.nickname,
                    chat_style: customerInfo.chat_style || '其他',
                    other_info: customerInfo.other_info || '无',
                    email: data.customer_0_email || ''
                })
            });
            const customerResult = await customerRes.json();
            data.customer_id = customerResult.customer?.id;
            
            if (customerResult.exists && customerResult.customer) {
                data.is_existing_customer = true;
            }
        }

        const orderRes = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                order_info: analyzedData.order_info,
                customer_info: analyzedData.customer_info,
                product_info: analyzedData.product_info
            })
        });
        const orderResult = await orderRes.json();

        if (orderResult.order) {
            const productInfo = analyzedData.product_info ? (Array.isArray(analyzedData.product_info) ? analyzedData.product_info[0] : analyzedData.product_info) : null;
            if (productInfo && productInfo.stock_impact === '需扣减库存') {
                await fetch(`${API_BASE}/inventory/deduct`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_name: productInfo.product_name,
                        quantity: parseInt(productInfo.quantity) || 1,
                        order_id: orderResult.order.id
                    })
                });
            }

            if (productInfo && productInfo.supplier_action === '需向对应供应商下单') {
                await fetch(`${API_BASE}/supplier-orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_name: productInfo.product_name,
                        quantity: parseInt(productInfo.quantity) || 1,
                        product_code: productInfo.product_code,
                        order_id: orderResult.order.id,
                        customer_nickname: data.order_0_customer_nickname
                    })
                });
            }
        }

        displayActionResult(orderResult, data);
        
        setTimeout(() => {
            removeImage();
        }, 3000);

    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
    }
}

function displayActionResult(orderResult, data) {
    const container = document.getElementById('actionResult');
    const content = document.getElementById('actionResultContent');
    
    let html = `<p><strong>订单ID：</strong>${orderResult.order?.id || '未知'}</p>`;
    
    if (data.is_existing_customer) {
        html += `<p class="text-green-600"><strong>客户：</strong>已存在的客户（${data.customer_0_nickname}），订单记录已归档</p>`;
    } else {
        html += `<p class="text-green-600"><strong>客户：</strong>新客户信息已创建（${data.customer_0_nickname}）</p>`;
    }
    
    const productInfo = analyzedData.product_info ? (Array.isArray(analyzedData.product_info) ? analyzedData.product_info[0] : analyzedData.product_info) : null;
    if (productInfo) {
        if (productInfo.stock_impact === '需扣减库存') {
            html += `<p><strong>库存：</strong>已扣减 ${productInfo.product_name} x ${productInfo.quantity || 1}</p>`;
        }
        if (productInfo.supplier_action === '需向对应供应商下单') {
            html += `<p><strong>供应商：</strong>已生成供应商订单（${productInfo.product_name} x ${productInfo.quantity || 1}）</p>`;
        }
    }
    
    html += `<p class="text-green-600 mt-2"><strong>状态：</strong>订单创建成功</p>`;
    
    content.innerHTML = html;
    container.classList.remove('hidden');
    document.getElementById('confirmContainer').classList.add('hidden');
}
