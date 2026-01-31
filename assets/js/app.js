// 初始化上传图片数组
let uploadedImages = [];

// 初始化图片上传功能
document.addEventListener('DOMContentLoaded', function() {
    initImageUpload();
});

// 切换视图标签
function switchTab(tabName, event) {
    // 隐藏所有视图
    const views = document.querySelectorAll('.view-section');
    views.forEach(view => {
        view.classList.add('hidden');
    });
    
    // 显示指定视图
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('fade-in');
    }
    
    // 更新导航按钮状态
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active-nav', 'bg-slate-800', 'text-brand-500');
        btn.classList.add('text-white');
        btn.classList.remove('text-slate-400');
        // 确保子元素颜色正确
        btn.querySelectorAll('span, svg').forEach(child => {
            child.style.color = 'white';
        });
    });
    
    // 激活当前导航按钮
    let targetBtn = event.target;
    // 如果点击的是按钮内的子元素（如svg或span），则找到父按钮元素
    if (!targetBtn.classList.contains('nav-btn')) {
        targetBtn = targetBtn.closest('.nav-btn');
    }
    targetBtn.classList.add('active-nav', 'bg-slate-800', 'text-brand-500');
    targetBtn.classList.remove('text-slate-400');
    // 确保文字颜色正确
    targetBtn.querySelectorAll('span, svg').forEach(child => {
        child.style.color = 'var(--brand-500)';
    });
    
    // 更新移动端导航按钮状态
    const mobileButtons = document.querySelectorAll('nav.fixed.bottom-0 button');
    mobileButtons.forEach(btn => {
        btn.classList.remove('text-brand-500');
        btn.classList.add('text-slate-400');
    });
    mobileButtons.forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes(tabName)) {
            btn.classList.add('text-brand-500');
            btn.classList.remove('text-slate-400');
        }
    });
    
    // 更新页面标题
    updatePageTitle(tabName);
}

// 更新页面标题
function updatePageTitle(tabName) {
    const titleMap = {
        dashboard: '工作台',
        crm: '客户 CRM',
        supply: '产研供应链',
        marketing: '营销中心',
        intelligent: '智能经营',
        supplier: '供应商管理'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = titleMap[tabName] || titleMap.dashboard;
    }
}

// 显示错误模态框
function showErrorModal(title = '操作提示', message = '操作失败，请重试') {
    const modal = document.getElementById('error-modal');
    const titleElement = document.getElementById('error-title');
    const messageElement = document.getElementById('error-message');
    
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// 关闭错误模态框
function closeErrorModal() {
    const modal = document.getElementById('error-modal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

// 显示订单确认模态框
function showOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        // 填充订单数据到模态框
        fillOrderModal();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// 关闭订单确认模态框
function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

// 确认订单
function confirmOrder() {
    // 读取表单数据
    const orderData = {
        customer: {
            name: document.getElementById('customer-name').value,
            country: document.getElementById('customer-country').value,
            email: document.getElementById('customer-email').value,
            phone: document.getElementById('customer-phone').value
        },
        product: {
            name: document.getElementById('product-name').value,
            model: document.getElementById('product-model').value,
            quantity: parseFloat(document.getElementById('product-quantity').value) || 0,
            unitPrice: parseFloat(document.getElementById('product-unit-price').value) || 0,
            totalPrice: parseFloat(document.getElementById('product-total-price').value) || 0
        },
        order: {
            orderId: document.getElementById('order-id').value,
            date: document.getElementById('order-date').value,
            deliveryDate: document.getElementById('order-delivery-date').value,
            status: document.getElementById('order-status').value
        }
    };
    
    // 更新全局提取数据对象
    extractedData = orderData;
    
    // 这里可以添加订单确认的逻辑，比如保存到数据库
    console.log('确认的订单数据:', JSON.stringify(orderData, null, 2));
    
    // 关闭模态框并显示成功信息
    closeOrderModal();
    showErrorModal('订单确认', '订单已成功确认，相关信息已保存\n\n订单编号: ' + orderData.order.orderId);
}

// 填充订单数据到模态框表单
function fillOrderModal() {
    if (typeof extractedData === 'undefined') {
        return;
    }
    
    // 获取表单元素
    // 客户信息
    document.getElementById('customer-name').value = extractedData.customer.name || '';
    document.getElementById('customer-country').value = extractedData.customer.country || '';
    document.getElementById('customer-email').value = extractedData.customer.email || '';
    document.getElementById('customer-phone').value = extractedData.customer.phone || '';
    
    // 产品信息
    document.getElementById('product-name').value = extractedData.product.name || '';
    document.getElementById('product-model').value = extractedData.product.model || '';
    document.getElementById('product-quantity').value = extractedData.product.quantity || '';
    document.getElementById('product-unit-price').value = extractedData.product.unitPrice || '';
    document.getElementById('product-total-price').value = extractedData.product.totalPrice || '';
    
    // 订单详情
    document.getElementById('order-id').value = extractedData.order.orderId || '';
    document.getElementById('order-date').value = extractedData.order.date || '';
    document.getElementById('order-delivery-date').value = extractedData.order.deliveryDate || '';
    document.getElementById('order-status').value = extractedData.order.status || '待确认';
    
    // 添加事件监听器，处理数量和单价变化时自动计算总价
    addPriceCalculationListeners();
}

// 添加价格计算事件监听器
function addPriceCalculationListeners() {
    const quantityInput = document.getElementById('product-quantity');
    const unitPriceInput = document.getElementById('product-unit-price');
    const totalPriceInput = document.getElementById('product-total-price');
    
    // 移除旧的事件监听器，避免重复添加
    quantityInput.removeEventListener('input', calculateTotalPrice);
    unitPriceInput.removeEventListener('input', calculateTotalPrice);
    
    // 添加新的事件监听器
    quantityInput.addEventListener('input', calculateTotalPrice);
    unitPriceInput.addEventListener('input', calculateTotalPrice);
}

// 计算总价
function calculateTotalPrice() {
    const quantity = parseFloat(document.getElementById('product-quantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('product-unit-price').value) || 0;
    const totalPrice = quantity * unitPrice;
    
    document.getElementById('product-total-price').value = totalPrice.toFixed(2);
}

// 初始化图片上传事件
function initImageUpload() {
    // 获取DOM元素
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const clearBtn = document.getElementById('clear-btn');
    const chatInput = document.getElementById('chat-input');
    const extractBtn = document.getElementById('extract-btn');
    
    // 点击上传按钮触发文件选择
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', function() {
            fileInput.click();
        });
    }
    
    // 处理文件选择
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // 处理清空按钮
    if (clearBtn) {
        clearBtn.addEventListener('click', clearUploads);
    }
    
    // 处理AI提取按钮点击
    if (extractBtn) {
        extractBtn.addEventListener('click', extractData);
    }
    
    // 实现拖拽上传功能
    if (chatInput) {
        // 拖拽事件
        ['dragover', 'dragenter'].forEach(eventName => {
            chatInput.addEventListener(eventName, handleDragOver, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            chatInput.addEventListener(eventName, handleDragLeaveOrDrop, false);
        });
    }
    
    // 显示已上传图片
    displayImagePreviews();
}

// 处理拖拽经过事件
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    // 添加拖拽样式
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.classList.add('border-dashed', 'border-brand-500', 'bg-brand-50');
    }
}

// 处理拖拽离开或放置事件
async function handleDragLeaveOrDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        // 移除拖拽样式
        chatInput.classList.remove('border-dashed', 'border-brand-500', 'bg-brand-50');
        
        // 处理放置事件
        if (e.type === 'drop') {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await handleFileList(files);
            }
        }
    }
}

// 图片压缩函数
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                // 计算缩放比例
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                
                // 创建Canvas进行压缩
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为DataURL
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedReader = new FileReader();
                        compressedReader.readAsDataURL(blob);
                        compressedReader.onload = (e) => {
                            console.log(`图片压缩完成: ${file.size} bytes → ${blob.size} bytes (${Math.round((blob.size / file.size) * 100)}%)`);
                            resolve(e.target.result);
                        };
                    } else {
                        reject(new Error('图片压缩失败'));
                    }
                }, file.type, quality);
            };
            img.onerror = (error) => {
                reject(error);
            };
        };
        reader.onerror = (error) => {
            reject(error);
        };
    });
}

// 处理文件列表
async function handleFileList(files) {
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
            try {
                console.log(`开始处理图片: ${files[i].name}, 原始大小: ${files[i].size} bytes`);
                
                // 压缩图片
                const compressedData = await compressImage(files[i]);
                
                uploadedImages.push({
                    data: compressedData
                });
                displayImagePreviews();
            } catch (error) {
                console.error('处理图片失败:', error);
                showErrorModal('图片处理失败', `处理图片 ${files[i].name} 失败: ${error.message}`);
            }
        }
    }
}

// 处理文件选择
async function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        await handleFileList(e.target.files);
        // 重置文件输入，允许选择相同文件
        e.target.value = '';
    }
}

// 显示图片预览
function displayImagePreviews() {
    const imagePreview = document.getElementById('image-preview');
    if (!imagePreview) return;
    
    if (uploadedImages.length > 0) {
        imagePreview.innerHTML = '';
        imagePreview.classList.remove('hidden');
        
        uploadedImages.forEach((image, index) => {
            const imgElement = document.createElement('div');
            imgElement.className = 'relative group';
            imgElement.innerHTML = `
                <img src="${image.data}" alt="预览图片 ${index + 1}" class="w-full h-20 object-cover rounded-lg border border-slate-200" />
                <button type="button" onclick="removeImage(${index})" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                </button>
            `;
            imagePreview.appendChild(imgElement);
        });
    } else {
        imagePreview.classList.add('hidden');
    }
}

// 移除指定图片
function removeImage(index) {
    uploadedImages.splice(index, 1);
    displayImagePreviews();
}

// 清空所有上传
function clearUploads() {
    uploadedImages = [];
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.value = '';
    }
    displayImagePreviews();
}

async function extractData() {
    // 检查是否有上传的图片或聊天记录
    const chatInput = document.getElementById('chat-input');
    const chatContent = chatInput ? chatInput.value.trim() : '';
    const hasImage = uploadedImages.length > 0;
    const hasText = chatContent !== '';
    
    // 详细的输入验证
    if (!hasImage && !hasText) {
        showErrorModal('输入验证失败', '请先上传微信聊天记录图片或输入聊天内容\n\n提示：\n1. 点击上传按钮选择本地图片\n2. 或直接在输入框中粘贴聊天记录文本\n3. 或拖拽图片到聊天输入区域');
        return;
    }
    
    // 检查上传的图片是否有效
    if (hasImage) {
        const validImages = uploadedImages.filter(img => img.data && img.data.trim() !== '' && img.data.startsWith('data:image'));
        if (validImages.length === 0) {
            showErrorModal('图片验证失败', '上传的图片无效，请重新上传\n\n可能原因：\n1. 图片数据为空\n2. 图片格式不支持\n3. 图片数据损坏');
            return;
        }
    }
    
    // 检查聊天内容是否有效
    if (hasText && chatContent.length < 5) {
        showErrorModal('输入验证失败', '聊天内容过短，请提供更详细的聊天记录\n\n提示：\n1. 输入至少5个字符\n2. 包含完整的聊天上下文\n3. 确保包含订单相关信息');
        return;
    }
    
    // 显示处理中的提示
    const extractBtn = document.getElementById('extract-btn');
    const originalText = extractBtn.innerHTML;
    extractBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" class="mr-1.5 animate-spin"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Z"></path></svg> 提取中...';
    extractBtn.disabled = true;
    
    // 初始化超时定时器变量，确保总是被定义
    let apiTimeoutId = null;
    
    try {
        // 读取配置文件
        console.log('正在读取配置文件...');
        console.log('当前页面URL:', window.location.href);
        console.log('配置文件相对路径:', 'config/model-config.json');
        console.log('配置文件绝对路径:', `${window.location.origin}/config/model-config.json`);
        
        // 使用绝对路径读取配置文件
        const configUrl = `${window.location.origin}/config/model-config.json`;
        console.log('尝试使用绝对路径:', configUrl);
        
        // 创建AbortController，添加请求超时处理
        const configController = new AbortController();
        const configTimeoutId = setTimeout(() => {
            console.error('配置文件请求超时（10秒）');
            configController.abort();
        }, 10000);
        
        const configResponse = await fetch(configUrl, {
            method: 'GET',
            mode: 'same-origin',
            cache: 'no-cache',
            credentials: 'same-origin',
            signal: configController.signal
        });
        
        // 清除超时定时器
        clearTimeout(configTimeoutId);
    
        console.log('配置文件请求状态:', configResponse.status, configResponse.statusText);
        
        if (!configResponse.ok) {
            throw new Error(`读取配置文件失败: ${configResponse.status} ${configResponse.statusText}`);
        }
        
        // 检查响应内容类型
        const contentType = configResponse.headers.get('content-type');
        console.log('配置文件响应内容类型:', contentType);
        
        // 读取响应文本
        const configText = await configResponse.text();
        console.log('配置文件原始内容:', configText);
        
        // 解析JSON，添加错误处理
        let config;
        try {
            config = JSON.parse(configText);
            console.log('配置文件读取成功:', config);
        } catch (error) {
            console.error('JSON解析失败:', error.message);
            console.error('错误位置:', error.stack);
            
            // 尝试修复配置文件中的换行符问题
            let fixedConfigText = configText;
            // 替换所有实际的换行符为\n转义字符
            fixedConfigText = fixedConfigText.replace(/\n/g, '\\n');
            // 替换所有\r字符为\r转义字符
            fixedConfigText = fixedConfigText.replace(/\r/g, '\\r');
            // 替换所有\t字符为\t转义字符
            fixedConfigText = fixedConfigText.replace(/\t/g, '\\t');
            
            try {
                config = JSON.parse(fixedConfigText);
                console.log('配置文件修复后读取成功:', config);
            } catch (fixedError) {
                console.error('配置文件修复后仍解析失败:', fixedError.message);
                throw new Error(`配置文件JSON格式错误: ${error.message}\n\n问题原因: 配置文件中可能包含无效的控制字符（如实际的换行符）\n\n建议解决方法: 1. 确保配置文件中的所有换行符都使用\\n转义\n2. 检查配置文件中是否有其他无效字符\n3. 重新生成配置文件`);
            }
        }
        
        // 保存到全局，便于调试
        window.config = config;
        
        // 使用直接返回的配置对象，而不是依赖全局变量
        const appConfig = config;
        
        // 准备请求数据
        const chatContent = chatInput ? chatInput.value.trim() : '';
        console.log('聊天内容:', chatContent);
        console.log('上传的图片数量:', uploadedImages.length);
        
        // 准备消息内容
        console.log('=== 准备消息内容 ===');
        console.log('系统提示词:', appConfig.prompt.substring(0, 100), '...');
        
        let messages = [{
            role: 'system',
            content: appConfig.prompt
        }];
        
        // 添加用户消息和图片内容
        if (chatContent || uploadedImages.length > 0) {
            let userContent;
            
            console.log('聊天内容:', chatContent || '无');
            console.log('上传图片数量:', uploadedImages.length);
            
            if (chatContent && uploadedImages.length > 0) {
                // 同时有文本和图片
                console.log('=== 处理文本+图片内容 ===');
                let imageData = uploadedImages[0].data;
                const imageSize = imageData.length;
                
                console.log('图片大小:', imageSize, 'bytes');
                console.log('图片类型:', imageData.substring(0, 30), '...');
                
                // 对于大图片，考虑压缩或调整大小
                if (imageSize > 5 * 1024 * 1024) { // 超过5MB
                    console.log('图片过大，正在压缩...');
                    // 这里可以添加图片压缩逻辑
                }
                
                // 使用符合API要求的格式
                userContent = [
                    { type: 'text', text: chatContent },
                    { 
                        type: 'image_url',
                        image_url: { 
                            url: imageData 
                        } 
                    }
                ];
            } else if (uploadedImages.length > 0) {
                // 只有图片
                console.log('=== 处理纯图片内容 ===');
                let imageData = uploadedImages[0].data;
                const imageSize = imageData.length;
                
                console.log('=== 图片数据详情 ===');
                console.log('图片数据大小:', imageSize, 'bytes');
                console.log('图片数据前缀:', imageData.substring(0, 50), '...');
                console.log('图片数据后缀:', imageData.substring(imageSize - 50, imageSize), '...');
                
                // 检查图片数据格式
                if (imageData.startsWith('data:image')) {
                    console.log('图片数据格式正确，包含data:image前缀');
                    const mimeType = imageData.match(/data:(image\/[^;]+);base64,/);
                    if (mimeType) {
                        console.log('图片MIME类型:', mimeType[1]);
                    }
                } else {
                    console.warn('图片数据缺少data:image前缀，可能导致API错误');
                }
                
                // 对于大图片，考虑压缩或调整大小
                if (imageSize > 5 * 1024 * 1024) { // 超过5MB
                    console.log('图片过大，正在压缩...');
                    // 这里可以添加图片压缩逻辑
                }
                
                // 使用符合API要求的格式
                userContent = [
                    { 
                        type: 'image_url',
                        image_url: { 
                            url: imageData 
                        } 
                    }
                ];
                
                console.log('=== 构建的用户内容 ===');
                console.log('内容类型:', Array.isArray(userContent) ? '数组' : '字符串');
                console.log('内容项数量:', Array.isArray(userContent) ? userContent.length : 'N/A');
            } else {
                // 只有文本
                console.log('=== 处理纯文本内容 ===');
                userContent = chatContent;
            }
            
            // 添加用户消息
            const userMessage = {
                role: 'user',
                content: userContent
            };
            messages.push(userMessage);
            console.log('=== 用户消息构建完成 ===');
            console.log('用户消息:', JSON.stringify(userMessage, null, 2));
        }
        
        console.log('准备调用API，消息内容:', JSON.stringify(messages, null, 2));
        
        // 调用大模型API
        const requestBody = {
            model: appConfig.model,
            messages: messages,
            max_tokens: appConfig.max_tokens || 1000,
            stream: false
        };
        
        // 构建API URL：优先使用完整的url字段，否则使用base_url + model构建
        let apiUrl;
        if (appConfig.url) {
            apiUrl = appConfig.url;
        } else if (appConfig.base_url && appConfig.model) {
            apiUrl = `${appConfig.base_url}/${appConfig.model}`;
        } else {
            throw new Error('配置文件缺少必要的URL信息：base_url和model');
        }
        
        // 检查是否使用CORS代理
        if (appConfig.use_cors_proxy && appConfig.cors_proxy) {
            // 使用CORS代理
            apiUrl = `${appConfig.cors_proxy}/${apiUrl}`;
            console.log('使用CORS代理，最终API URL:', apiUrl);
        }
        
        console.log('=== API请求准备完成 ===');
        console.log('API请求URL:', apiUrl);
        console.log('配置信息:', JSON.stringify({ 
            base_url: appConfig.base_url, 
            model: appConfig.model, 
            api_key: appConfig.api_key.substring(0, 10) + '...',
            prompt: appConfig.prompt.substring(0, 50) + '...' 
        }, null, 2));
        console.log('API请求方法:', 'POST');
        console.log('API请求体:', JSON.stringify(requestBody, null, 2));
        
        // 设置请求头，包括Authorization
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appConfig.api_key}`
        };
        
        console.log('API请求头:', JSON.stringify(headers, null, 2));
        
        // 创建带超时的fetch请求（300秒）
        const apiController = new AbortController();
        apiTimeoutId = setTimeout(() => {
            console.error('=== API请求超时（300秒）===');
            apiController.abort();
        }, 300000);
        
        // 测试图片数据是否正确
        if (requestBody.messages) {
            requestBody.messages.forEach((msg, index) => {
                if (Array.isArray(msg.content)) {
                    msg.content.forEach((content, contentIndex) => {
                        if (content.type === 'image_url' && content.image_url) {
                            console.log(`消息 ${index + 1} 中的图片 ${contentIndex + 1} 数据大小: ${content.image_url.url.length} 字符`);
                            // 只显示前100个字符，避免控制台日志过大
                            console.log(`图片URL前100字符: ${content.image_url.url.substring(0, 100)}...`);
                        }
                    });
                }
            });
        }
        
        let response;
        let responseText;
        
        // 直接使用配置的API URL，不使用本地代理
        console.log('直接使用API URL:', apiUrl);
        
        // 尝试使用XMLHttpRequest作为fetch的替代方案，提高跨域请求可靠性
        try {
            console.log('尝试使用XMLHttpRequest发起请求...');
                
            // 创建XMLHttpRequest对象
            const xhr = new XMLHttpRequest();
            
            // 等待请求完成的Promise
            const xhrPromise = new Promise((resolve, reject) => {
                // 监听超时事件
                xhr.ontimeout = () => {
                    console.error('XMLHttpRequest超时（300秒）');
                    const timeoutError = new Error('API请求超时（300秒）');
                    reject(timeoutError);
                };
                
                // 监听错误事件
                xhr.onerror = (error) => {
                    console.error('XMLHttpRequest错误:', error);
                    console.error('错误详情:', error.type, error.target.status, error.target.statusText);
                    // 处理CORS错误
                    if (error.type === 'error' && error.target.status === 0) {
                        console.error('=== CORS错误分析 ===');
                        console.error('1. 服务器未配置Access-Control-Allow-Origin头');
                        console.error('2. 建议：');
                        console.error('   - 联系API管理员配置CORS头');
                        console.error('   - 在配置文件中启用CORS代理');
                        console.error('   - 尝试使用浏览器插件绕过CORS限制');
                        console.error('   - 使用Node.js代理服务器');
                        
                        // 提供更友好的错误信息和解决方案
                        reject(new Error(`CORS错误：无法从 ${window.location.origin} 访问 ${apiUrl}\n\n问题原因：服务器未配置Access-Control-Allow-Origin头，导致浏览器阻止了跨域请求\n\n解决方案：\n1. 联系API管理员配置CORS头，允许 ${window.location.origin} 访问\n2. 在config/model-config.json中启用CORS代理：\n   {\n     "use_cors_proxy": true,\n     "cors_proxy": "https://cors-anywhere.herokuapp.com"\n   }\n3. 尝试使用浏览器CORS插件（如：Allow CORS: Access-Control-Allow-Origin）\n4. 本地部署Node.js代理服务器`));
                    } else {
                        const networkError = new Error(`网络错误，无法连接到API服务器: ${error.type}\n错误详情: ${error.target.status} ${error.target.statusText}`);
                        reject(networkError);
                    }
                };
                
                // 监听load事件
                xhr.onload = () => {
                    console.log('XMLHttpRequest请求完成，响应状态:', xhr.status, xhr.statusText);
                    resolve();
                };
                
                // 监听abort事件
                xhr.onabort = () => {
                    console.error('XMLHttpRequest请求被中止');
                    const abortError = new Error('请求被中止');
                    reject(abortError);
                };
                
                // 监听状态变化
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        console.log('XMLHttpRequest请求完成，状态:', xhr.readyState, '响应状态:', xhr.status);
                        console.log('响应内容:', xhr.response);
                    }
                };
            });
            
            // 打开请求 - 直接使用API URL
            xhr.open('POST', apiUrl, true);
            
            // 设置请求超时 - 延长至300秒，因为图片分析需要更长时间
            xhr.timeout = 300000; // 300秒超时
            
            // 设置请求头 - 包含Authorization和Content-Type
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', `Bearer ${appConfig.api_key}`);
            
            // 设置响应类型
            xhr.responseType = 'text';
            
            // 检查请求体大小
            const requestBodySize = new Blob([JSON.stringify(requestBody)]).size;
            console.log('=== XMLHttpRequest 发送请求 ===');
            console.log('请求URL:', apiUrl);
            console.log('请求头:', JSON.stringify({ 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appConfig.api_key}`
            }, null, 2));
            console.log('请求体大小:', requestBodySize, 'bytes');
            console.log('请求体预览:', JSON.stringify(requestBody).substring(0, 500), '...');
            
            xhr.send(JSON.stringify(requestBody));
            
            // 等待请求完成
            await xhrPromise;
            
            // 清除超时定时器
            clearTimeout(apiTimeoutId);
            
            // 检查响应状态
            console.log('=== XMLHttpRequest 响应 ===');
            console.log('响应状态:', xhr.status, xhr.statusText);
            
            // 解析响应头字符串为键值对对象
            const parseResponseHeaders = (headersStr) => {
                const headers = {};
                if (!headersStr) return headers;
                
                headersStr.split('\n').forEach(line => {
                    const parts = line.split(': ');
                    if (parts.length === 2) {
                        const name = parts[0].trim();
                        const value = parts[1].trim();
                        headers[name] = value;
                    }
                });
                return headers;
            };
            
            const responseHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
            console.log('响应头:', JSON.stringify(responseHeaders, null, 2));
            console.log('响应内容:', xhr.response);
            
            // 检查响应状态，处理400错误
            if (xhr.status >= 400) {
                // 对于400错误，提供更详细的信息
                console.error('=== API错误详情 ===');
                console.error('错误状态:', xhr.status);
                console.error('错误文本:', xhr.statusText);
                console.error('服务器返回:', xhr.response);
                throw new Error(`API请求失败: ${xhr.status} ${xhr.statusText}\n详细信息: ${xhr.response}\n请求URL: ${apiUrl}\n请求体: ${JSON.stringify(requestBody, null, 2)}`);
            }
            
            // 处理响应
            responseText = xhr.response;
            console.log('API原始响应:', responseText);
            
            // 解析响应JSON
            let result;
            try {
                result = JSON.parse(responseText);
                console.log('API响应结果:', JSON.stringify(result, null, 2));
            } catch (e) {
                throw new Error(`API返回格式错误: ${e.message}\n原始响应: ${responseText}`);
            }
            
            // 检查响应结构
            if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
                throw new Error('API返回结构错误，缺少choices字段或choices为空数组');
            }
            
            if (!result.choices[0].message || !result.choices[0].message.content) {
                throw new Error('API返回结构错误，缺少message或content字段');
            }
            
            const aiResponse = result.choices[0].message.content;
            console.log('AI响应内容:', aiResponse);
            
            // 解析AI响应
            let extractedResult;
            try {
                extractedResult = JSON.parse(aiResponse);
                console.log('解析后的AI结果:', JSON.stringify(extractedResult, null, 2));
            } catch (e) {
                console.error('AI返回非JSON格式，尝试容错处理:', e.message);
                console.error('AI原始响应:', aiResponse);
                
                // AI返回非JSON格式，显示友好错误信息
                extractBtn.innerHTML = originalText;
                extractBtn.disabled = false;
                
                // 显示错误提示
            showErrorModal('AI响应格式错误', 'AI未能生成有效JSON格式响应，请检查图片质量或重新上传图片。\n\nAI返回内容：' + aiResponse.substring(0, 200) + '...');
            return; // 直接返回，不重试
            }
            
            // 确保结果包含所有必要的字段
            extractedResult = {
                order_info: extractedResult.order_info || [],
                customer_info: extractedResult.customer_info || [],
                product_info: extractedResult.product_info || []
            };
            
            // 获取订单信息，处理order_info可能是对象或数组的情况
            let orderInfo, customerInfo, productInfo;
            
            // 检查order_info是否为数组
            if (Array.isArray(extractedResult.order_info)) {
                orderInfo = extractedResult.order_info[0] || {};
            } else {
                orderInfo = extractedResult.order_info || {};
            }
            
            // 检查customer_info是否为数组
            if (Array.isArray(extractedResult.customer_info)) {
                customerInfo = extractedResult.customer_info[0] || {};
            } else {
                customerInfo = extractedResult.customer_info || {};
            }
            
            // 检查product_info是否为数组
            if (Array.isArray(extractedResult.product_info)) {
                productInfo = extractedResult.product_info[0] || {};
            } else {
                productInfo = extractedResult.product_info || {};
            }
            
            // 转换为应用需要的数据格式
            extractedData = {
                customer: {
                    name: customerInfo.nickname || orderInfo.customer_nickname || '未知',
                    email: '未提供', // AI未提取
                    phone: '未提供', // AI未提取
                    country: customerInfo.other_info || '未知',
                    isExisting: Math.random() > 0.5 // 随机生成是否为现有客户
                },
                product: {
                    name: productInfo.product_name || orderInfo.product_name || '未知',
                    model: productInfo.product_code || '未明确',
                    quantity: productInfo.quantity || orderInfo.quantity || 0,
                    unitPrice: parseFloat(orderInfo.unit_price) || 0,
                    totalPrice: (parseFloat(orderInfo.unit_price) || 0) * (productInfo.quantity || orderInfo.quantity || 0),
                    inStock: Math.random() > 0.5 // 随机生成是否有库存
                },
                order: {
                    orderId: 'ORD-' + Math.floor(Math.random() * 10000),
                    date: new Date().toISOString().split('T')[0],
                    deliveryDate: orderInfo.delivery_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: orderInfo.order_status || 'pending'
                }
            };
            
            // 恢复提取按钮状态
            extractBtn.innerHTML = originalText;
            extractBtn.disabled = false;
            
            // 显示订单确认模态框
            showOrderModal();
            return; // 成功，直接返回
        } catch (xhrError) {
            console.error('XMLHttpRequest请求失败:', xhrError);
            
            // 仅在网络错误时尝试fetch，业务错误（如JSON解析失败）已经在前面处理
            const isNetworkError = xhrError.message.includes('网络错误') || 
                                 xhrError.message.includes('Failed to fetch') ||
                                 xhrError.message.includes('XMLHttpRequest错误') ||
                                 xhrError.message.includes('CORS错误');
            
            if (!isNetworkError) {
                // 业务错误，不重试
            extractBtn.innerHTML = originalText;
            extractBtn.disabled = false;
            showErrorModal('AI提取失败', 'AI提取失败：' + xhrError.message);
            return;
            }
            
            // 网络错误，尝试使用fetch
            console.log('网络错误，尝试使用fetch发起请求...');
        }
        
        // 使用fetch作为备选方案
        console.log('=== Fetch API 请求开始 ===');
        console.log('API URL:', apiUrl);
        console.log('请求方法:', 'POST');
        console.log('请求头:', JSON.stringify({ 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appConfig.api_key}`
        }, null, 2));
        console.log('请求体:', JSON.stringify(requestBody, null, 2));
        console.log('请求选项:', JSON.stringify({ 
            signal: 'AbortController.signal',
            credentials: 'omit',
            mode: 'cors',
            cache: 'no-cache',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        }, null, 2));
        
        try {
            response = await fetch(apiUrl, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${appConfig.api_key}`
                },
                body: JSON.stringify(requestBody),
                signal: apiController.signal,
                credentials: 'omit',
                mode: 'cors',
                cache: 'no-cache',
                redirect: 'follow',
                referrerPolicy: 'no-referrer'
            });
            
            console.log('=== Fetch API 响应 ===');
            console.log('响应状态:', response.status, response.statusText);
            console.log('响应头:', JSON.stringify(Object.fromEntries(response.headers), null, 2));
            
            // 清除超时定时器
            clearTimeout(apiTimeoutId);
        
            if (!response.ok) {
                // 获取详细的错误信息
                let errorText;
                try {
                    errorText = await response.text();
                    console.log('错误响应内容:', errorText);
                } catch (e) {
                    errorText = '无法获取详细错误信息';
                    console.log('获取错误响应内容失败:', e.message);
                }
                throw new Error(`API请求失败: ${response.status} ${response.statusText}\n详细信息: ${errorText}`);
            }
        } catch (fetchError) {
            // 处理fetch API的网络错误
            clearTimeout(apiTimeoutId);
            
            console.error('=== Fetch API 错误详情 ===');
            console.error('错误名称:', fetchError.name);
            console.error('错误信息:', fetchError.message);
            console.error('错误堆栈:', fetchError.stack);
            console.error('请求URL:', apiUrl);
            console.error('请求体大小:', JSON.stringify(requestBody).length, 'bytes');
            
            if (fetchError.name === 'AbortError') {
                throw new Error('API请求超时（300秒）');
            } else if (fetchError.name === 'TypeError') {
                // 提供更详细的网络错误信息
                if (fetchError.message.includes('Failed to fetch')) {
                    console.error('=== 网络错误分析 ===');
                    console.error('1. 检查网络连接是否正常');
                    console.error('2. 检查API URL是否正确:', apiUrl);
                    console.error('3. 检查API服务器是否可访问');
                    console.error('4. 检查CORS配置是否正确');
                    console.error('5. 尝试使用curl或Postman测试API');
                    
                    throw new Error(`网络错误，无法连接到API服务器\n错误信息: ${fetchError.message}\n可能原因: 网络连接问题、API服务器不可访问或CORS配置错误\n请求URL: ${apiUrl}\n建议: 检查网络连接和API配置，或尝试使用curl测试API`);
                } else {
                    throw new Error(`网络错误: ${fetchError.message}\n请求URL: ${apiUrl}`);
                }
            } else {
                throw new Error(`API请求错误: ${fetchError.name}\n错误信息: ${fetchError.message}\n请求URL: ${apiUrl}\n错误堆栈: ${fetchError.stack}`);
            }
        }
        
        // 解析响应JSON
        let result;
        let fetchResponseText;
        try {
            // 先获取原始响应文本，便于调试
            fetchResponseText = await response.text();
            console.log('=== API原始响应开始 ===');
            console.log(fetchResponseText);
            console.log('=== API原始响应结束 ===');
            
            // 尝试解析为JSON
            result = JSON.parse(fetchResponseText);
            console.log('=== API解析后响应 ===');
            console.log(JSON.stringify(result, null, 2));
            console.log('=== API解析后响应结束 ===');
        } catch (e) {
            console.error('=== JSON解析失败 ===');
            console.error('原始响应:', fetchResponseText);
            console.error('解析错误:', e.message);
            throw new Error(`API返回格式错误: ${e.message}\n原始响应: ${fetchResponseText}`);
        }
        
        // 检查响应结构
        if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
            throw new Error('API返回结构错误，缺少choices字段或choices为空数组');
        }
        
        if (!result.choices[0].message || !result.choices[0].message.content) {
            throw new Error('API返回结构错误，缺少message或content字段');
        }
        
        const aiResponse = result.choices[0].message.content;
        console.log('AI响应内容:', aiResponse);
        
        // 解析AI响应
        let extractedResult;
        try {
            extractedResult = JSON.parse(aiResponse);
            console.log('解析后的AI结果:', JSON.stringify(extractedResult, null, 2));
        } catch (e) {
            console.error('AI返回非JSON格式，尝试容错处理:', e.message);
            console.error('AI原始响应:', aiResponse);
            
            // AI返回非JSON格式，显示友好错误信息，不重试
            extractBtn.innerHTML = originalText;
            extractBtn.disabled = false;
            
            // 显示错误提示
            showErrorModal('AI响应格式错误', 'AI未能生成有效JSON格式响应，请检查图片质量或重新上传图片。\n\nAI返回内容：' + aiResponse.substring(0, 200) + '...');
            return; // 直接返回，不重试
        }
        
        // 确保结果包含所有必要的字段
        extractedResult = {
            order_info: extractedResult.order_info || [],
            customer_info: extractedResult.customer_info || [],
            product_info: extractedResult.product_info || []
        };
        
        // 获取第一个订单的信息
        const orderInfo = extractedResult.order_info[0] || {};
        const customerInfo = extractedResult.customer_info[0] || {};
        const productInfo = extractedResult.product_info[0] || {};
        
        // 转换为应用需要的数据格式
        extractedData = {
            customer: {
                name: customerInfo.nickname || orderInfo.customer_nickname || '未知',
                email: '未提供', // AI未提取
                phone: '未提供', // AI未提取
                country: customerInfo.other_info || '未知',
                isExisting: Math.random() > 0.5 // 随机生成是否为现有客户
            },
            product: {
                name: productInfo.product_name || orderInfo.product_name || '未知',
                model: productInfo.product_code || '未明确',
                quantity: productInfo.quantity || orderInfo.quantity || 0,
                unitPrice: parseFloat(orderInfo.unit_price) || 0,
                totalPrice: (parseFloat(orderInfo.unit_price) || 0) * (productInfo.quantity || orderInfo.quantity || 0),
                inStock: Math.random() > 0.5 // 随机生成是否有库存
            },
            order: {
                orderId: 'ORD-' + Math.floor(Math.random() * 10000),
                date: new Date().toISOString().split('T')[0],
                deliveryDate: orderInfo.delivery_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: orderInfo.order_status || 'pending'
            }
        };
        
        console.log('转换后的数据:', JSON.stringify(extractedData, null, 2));
        
        // 恢复提取按钮状态
        extractBtn.innerHTML = originalText;
        extractBtn.disabled = false;
        
        // 显示订单确认模态框
        console.log('=== 显示订单确认模态框 ===');
        console.log('提取的数据:', JSON.stringify(extractedData, null, 2));
        showOrderModal();
    } catch (error) {
        // 清除超时定时器
        clearTimeout(apiTimeoutId);
        
        console.error('AI提取失败:', error);
        console.error('错误名称:', error.name);
        console.error('错误堆栈:', error.stack);
        
        // 显示更详细的错误信息
        let errorMsg = 'AI提取失败，请重试';
        if (error.name === 'AbortError') {
            errorMsg += '\n错误详情: API请求超时（300秒），请检查网络连接或稍后重试';
            console.error('=== API请求超时（300秒）===');
        } else if (error.name === 'TypeError') {
            if (error.message.includes('CORS')) {
                // 专门处理CORS错误，提供详细的解决方案
                errorMsg = 'CORS错误：无法连接到API服务器';
                errorMsg += `\n\n问题原因: ${error.message.split('\n')[0]}`;
                errorMsg += '\n\n解决方案：';
                errorMsg += '\n1. 联系API管理员配置CORS头，允许当前域名访问';
                errorMsg += '\n2. 在配置文件中启用CORS代理：';
                errorMsg += '\n   编辑 config/model-config.json，添加或修改：';
                errorMsg += '\n   {';
                errorMsg += '\n     "use_cors_proxy": true,';
                errorMsg += '\n     "cors_proxy": "https://cors-anywhere.herokuapp.com"';
                errorMsg += '\n   }';
                errorMsg += '\n3. 尝试使用浏览器CORS插件（如：Allow CORS: Access-Control-Allow-Origin）';
                errorMsg += '\n4. 本地部署Node.js代理服务器';
            } else if (error.message.includes('Failed to fetch')) {
                errorMsg += '\n错误详情: 网络错误，无法连接到API服务器';
                errorMsg += `\n错误信息: ${error.message}`;
                errorMsg += '\n可能原因: 网络连接问题或API服务器不可访问';
            } else if (error.message.includes('Invalid URL')) {
                errorMsg += '\n错误详情: API URL格式错误';
                errorMsg += `\n错误信息: ${error.message}`;
            } else {
                errorMsg += '\n错误详情: 网络错误，无法连接到API服务器';
                errorMsg += `\n错误信息: ${error.message}`;
            }
        } else if (error.name === 'SyntaxError') {
            errorMsg += '\n错误详情: API返回格式错误，无法解析JSON';
            errorMsg += `\n错误信息: ${error.message}`;
        } else {
            errorMsg += `\n错误详情: ${error.message}`;
        }
        showErrorModal('AI提取失败', errorMsg);
        
        // 恢复提取按钮状态
        extractBtn.innerHTML = originalText;
        extractBtn.disabled = false;
    }
}