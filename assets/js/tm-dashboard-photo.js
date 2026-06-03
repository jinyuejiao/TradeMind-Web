/**
 * 工作台识图拍照/选图（index-app 主壳 photo-modal 与 dashboard 共用）
 * 避免 ui-main.js 占位逻辑导致移动端未压缩 HEIC、未设置 selectedImageFile。
 */
(function () {
    'use strict';

    var REV = '20260603photo';

    function resolveTmOssUpload() {
        if (window.TMOssUpload) {
            return window.TMOssUpload;
        }
        try {
            if (window.parent && window.parent !== window && window.parent.TMOssUpload) {
                return window.parent.TMOssUpload;
            }
        } catch (eParent) { /* ignore */ }
        return null;
    }

    function resetPhoto() {
        var preview = document.getElementById('image-preview');
        var previewArea = document.getElementById('photo-preview-area');
        var submitBtn = document.getElementById('photo-submit-btn');
        if (preview) {
            preview.src = '';
        }
        if (previewArea) {
            previewArea.classList.add('hidden');
        }
        if (submitBtn) {
            submitBtn.disabled = true;
        }
        window.capturedImageBlob = null;
        window.selectedImageFile = null;
    }

    async function compressPhotoBlob(input) {
        var aiSvc = window.TM_AIService;
        if (aiSvc && typeof aiSvc.compressImageIfNeeded === 'function') {
            return aiSvc.compressImageIfNeeded(input);
        }
        return input;
    }

    async function handlePhotoSelected(input) {
        try {
            if (!input.files || !input.files[0]) {
                return;
            }
            var file = input.files[0];
            var processed = await compressPhotoBlob(file);
            var reader = new FileReader();
            reader.onload = function (e) {
                var preview = document.getElementById('image-preview');
                var previewArea = document.getElementById('photo-preview-area');
                var submitBtn = document.getElementById('photo-submit-btn');
                window.selectedImageFile = processed;
                window.capturedImageBlob = null;
                if (preview) {
                    preview.src = e.target.result;
                }
                if (previewArea) {
                    previewArea.classList.remove('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
            };
            reader.onerror = function () {
                if (typeof showToast === 'function') {
                    showToast('读取图片失败，请换一张重试');
                }
            };
            reader.readAsDataURL(processed);
            input.value = '';
        } catch (error) {
            console.error('[TM_DashboardPhoto] 处理照片选择失败:', error, 'rev=', REV);
            if (typeof showToast === 'function') {
                showToast((error && error.message) || '处理照片失败，请重试');
            }
        }
    }

    async function resolveSubmitBlob() {
        var preview = document.getElementById('image-preview');
        if (!preview || !preview.src) {
            throw new Error('请先选择照片');
        }
        var blob;
        if (window.capturedImageBlob) {
            blob = window.capturedImageBlob;
        } else if (window.selectedImageFile) {
            blob = window.selectedImageFile;
        } else {
            var imageUrl = preview.src;
            if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
                var res = await fetch(imageUrl);
                blob = await res.blob();
            } else {
                throw new Error('图片预览无效，请重新选择');
            }
        }
        return compressPhotoBlob(blob);
    }

    async function processImageWithAIService(imageBlob) {
        var ossUpload = resolveTmOssUpload();
        if (!ossUpload || typeof ossUpload.uploadDashboardImage !== 'function') {
            throw new Error('OSS 上传模块未加载，请刷新页面');
        }
        var uploadBlob = imageBlob;
        if (uploadBlob && (!uploadBlob.type || uploadBlob.type === 'application/octet-stream')) {
            try {
                uploadBlob = new Blob([uploadBlob], { type: 'image/jpeg' });
            } catch (eBlob) { /* keep original */ }
        }
        var imageUrl = await ossUpload.uploadDashboardImage(uploadBlob);
        if (!imageUrl) {
            throw new Error('上传成功但未获得图片访问地址，请检查 OSS 配置');
        }

        if (typeof closePhotoModal === 'function') {
            closePhotoModal();
        }
        resetPhoto();

        if (typeof showToast === 'function') {
            showToast('已提交AI订单提取，正在识别中...');
        }

        var response = await window.wrappedFetch('/api/v1/ai/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskType: 'ORDER_EXTRACT',
                inputType: 'IMAGE',
                payload: { imageUrls: [imageUrl] }
            })
        });

        var execImg = null;
        if (typeof window.handleApiResponse === 'function') {
            execImg = await window.handleApiResponse(response);
        } else {
            if (!response.ok) {
                throw new Error('AI 服务调用失败，状态码: ' + response.status);
            }
            execImg = await response.json();
            if (execImg && execImg.success === false) {
                throw new Error(execImg.message || 'AI 受理失败');
            }
        }
        if (!execImg) {
            return;
        }
        if (window.TM_PendingOrdersStore && typeof window.TM_PendingOrdersStore.scheduleAfterSubmit === 'function') {
            window.TM_PendingOrdersStore.scheduleAfterSubmit();
        } else if (typeof schedulePendingOrdersRefresh === 'function') {
            schedulePendingOrdersRefresh(3, 2000);
        }
        if (typeof TM_refreshDashboardPendingOrders === 'function') {
            TM_refreshDashboardPendingOrders();
        }
    }

    async function submitPhoto() {
        try {
            var blob = await resolveSubmitBlob();
            await processImageWithAIService(blob);
        } catch (error) {
            console.error('[TM_DashboardPhoto] 提交照片失败:', error, 'rev=', REV);
            var msg = (error && error.message) ? String(error.message) : '';
            if (typeof showToast === 'function') {
                showToast(msg ? ('处理图片失败：' + msg) : '处理图片失败，请重试');
            }
        }
    }

    window.TM_DashboardPhoto = {
        REV: REV,
        resetPhoto: resetPhoto,
        handlePhotoSelected: handlePhotoSelected,
        submitPhoto: submitPhoto,
        processImageWithAIService: processImageWithAIService
    };

    window.handlePhotoSelected = handlePhotoSelected;
    window.submitPhoto = submitPhoto;
    window.resetPhoto = resetPhoto;
})();
