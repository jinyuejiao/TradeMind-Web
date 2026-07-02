/**

 * 外设设置 — 工作台「打印·外设」入口

 */

(function (global) {

    'use strict';



    function esc(s) {

        return String(s == null ? '' : s)

            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    }



    function notify(msg, type) {

        if (global.TM_UI && global.TM_UI.showNotification) global.TM_UI.showNotification(msg, type || 'info');

    }



    function isAdmin() {

        var role = global.TM_UI_CONTEXT && global.TM_UI_CONTEXT.role;

        if (global.TM_ROLE_SCHEMA && global.TM_ROLE_SCHEMA.normalizeRole) {

            return global.TM_ROLE_SCHEMA.normalizeRole(role) === 'ADMIN';

        }

        return String(role || '').toUpperCase() === 'ADMIN';

    }



    function ensureModal() {

        if (document.getElementById('peripheral-settings-modal')) return;

        var el = document.createElement('div');

        el.id = 'peripheral-settings-modal';

        el.className = 'tm-unified-mobile-modal hidden fixed inset-0 z-[130] flex items-end md:items-center justify-center p-0 md:p-6';

        el.innerHTML =

            '<div class="tm-modal-backdrop absolute inset-0 bg-slate-900/55" onclick="TM_Peripheral.close()"></div>' +

            '<div class="relative bg-white w-full max-w-lg md:max-w-xl rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col max-h-[90dvh]">' +

            '<header class="px-4 py-3 border-b flex justify-between items-center shrink-0">' +

            '<div><h3 class="font-bold text-slate-800">打印 · 外设</h3>' +

            '<p class="text-[10px] text-slate-400">管理云打印机与店铺抬头</p></div>' +

            '<button type="button" onclick="TM_Peripheral.close()" class="p-2 hover:bg-slate-100 rounded-full"><i class="ph ph-x"></i></button></header>' +

            '<main class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" id="peripheral-settings-body"></main>' +

            '<footer class="p-4 border-t shrink-0 flex gap-2" id="peripheral-settings-footer">' +

            '<button type="button" onclick="TM_Peripheral.close()" class="tm-btn-secondary flex-1 py-2.5 text-xs font-bold">关闭</button>' +

            '<button type="button" id="peripheral-add-btn" onclick="TM_Peripheral.showAddForm()" class="tm-btn-primary flex-1 py-2.5 text-xs font-bold hidden" data-action="printer.manage">添加打印机</button>' +

            '</footer></div>';

        document.body.appendChild(el);

    }



    function openModal(el) {

        if (typeof global.TM_openUnifiedModal === 'function') global.TM_openUnifiedModal(el);

        else { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }

    }



    function closeModal(el) {

        if (typeof global.TM_closeUnifiedModal === 'function') global.TM_closeUnifiedModal(el);

        else { el.classList.add('hidden'); document.body.style.overflow = ''; }

    }



    async function saveShopSettings(settings) {

        if (!global.TM_PrintApi) return;

        var res = await global.TM_PrintApi.saveSettings({

            shopDisplayName: settings.shopDisplayName,

            contactPhone: settings.contactPhone,

            address: settings.address,

            footerText: settings.footerText,

            defaultPrinterId: settings.defaultPrinterId

        });

        if (res.success) {

            notify('店铺抬头已保存', 'success');

            if (global.TM_Print && global.TM_Print.invalidateSettingsCache) global.TM_Print.invalidateSettingsCache();

        } else notify(res.message || '保存失败', 'error');

    }



    async function renderList() {

        var body = document.getElementById('peripheral-settings-body');

        if (!body || !global.TM_PrintApi) return;

        body.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">加载中…</p>';

        var res = await global.TM_PrintApi.listDevices();

        var list = res && res.success && Array.isArray(res.data) ? res.data : [];

        var settingsRes = await global.TM_PrintApi.getSettings();

        var settings = settingsRes && settingsRes.success ? settingsRes.data : {};

        var admin = isAdmin();



        var html = '<section class="rounded-xl border border-slate-100 p-3 space-y-2 text-xs">';

        html += '<p class="font-bold text-slate-600">店铺抬头</p>';

        if (admin) {

            html += '<input id="ps-shop-name" class="form-input form-input--compact w-full" placeholder="店铺名称" value="' + esc(settings.shopDisplayName || '') + '"/>';

            html += '<input id="ps-shop-phone" class="form-input form-input--compact w-full" placeholder="联系电话" value="' + esc(settings.contactPhone || '') + '"/>';

            html += '<input id="ps-shop-footer" class="form-input form-input--compact w-full" placeholder="页脚文案" value="' + esc(settings.footerText || '') + '"/>';

            html += '<button type="button" class="tm-btn-secondary w-full py-2 text-xs font-bold" onclick="TM_Peripheral.saveShop()">保存抬头</button>';

        } else {

            html += '<p>' + esc(settings.shopDisplayName || '—') + '</p>';

            html += '<p class="text-slate-400">' + esc(settings.contactPhone || '') + '</p>';

        }

        html += '</section>';



        if (!list.length) {

            html += '<p class="text-center text-slate-400 text-sm py-4">暂无云打印机</p>';

        } else {

            html += list.map(function (d) {

                var def = d.isDefault ? ' <span class="text-teal-600 font-bold">默认</span>' : '';

                var adminBtns = admin

                    ? ('<button type="button" class="text-[10px] px-2 py-1 rounded-lg border border-slate-200" onclick="TM_Peripheral.setDefault(\'' + esc(d.deviceId) + '\')">设默认</button>' +

                       '<button type="button" class="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-600" onclick="TM_Peripheral.remove(\'' + esc(d.deviceId) + '\')">删除</button>')

                    : '';

                return '<div class="border border-slate-100 rounded-xl p-3 flex justify-between items-start gap-2">' +

                    '<div><p class="font-bold text-sm text-slate-800">' + esc(d.deviceName) + def + '</p>' +

                    '<p class="text-[10px] text-slate-400">' + esc(d.vendor || 'FEIE') + ' · ' + esc(d.connectionProtocol) + '</p></div>' +

                    '<div class="flex flex-wrap gap-1 shrink-0 justify-end">' +

                    '<button type="button" class="text-[10px] px-2 py-1 rounded-lg border border-slate-200" onclick="TM_Peripheral.test(\'' + esc(d.deviceId) + '\')">测试</button>' +

                    adminBtns +

                    '</div></div>';

            }).join('');

        }



        html += '<section class="text-[10px] text-slate-400 leading-relaxed space-y-1">' +

            '<p><strong>PC：</strong>浏览器打印三联销售单/进货单。</p>' +

            '<p><strong>移动/热敏：</strong>绑定飞鹅或易联云 SN+KEY，设为默认后自动云打印。</p>' +

            '<p><strong>扫码枪：</strong>极速开单弹窗打开时扫描加 SKU；也可点「相机扫码」。</p></section>';



        if (admin && document.getElementById('peripheral-add-panel')) {

            html += document.getElementById('peripheral-add-panel').outerHTML;

        }



        body.innerHTML = html;



        var addBtn = document.getElementById('peripheral-add-btn');

        if (addBtn) addBtn.classList.toggle('hidden', !admin);

        if (typeof global.applyRoleUI === 'function') global.applyRoleUI({ skipTabSync: true });

    }



    global.TM_Peripheral = {

        open: async function () {

            ensureModal();

            openModal(document.getElementById('peripheral-settings-modal'));

            await renderList();

        },

        close: function () {

            closeModal(document.getElementById('peripheral-settings-modal'));

        },

        saveShop: async function () {

            var settingsRes = await global.TM_PrintApi.getSettings();

            var settings = settingsRes && settingsRes.success ? settingsRes.data : {};

            await saveShopSettings({

                shopDisplayName: (document.getElementById('ps-shop-name') || {}).value || '',

                contactPhone: (document.getElementById('ps-shop-phone') || {}).value || '',

                footerText: (document.getElementById('ps-shop-footer') || {}).value || '',

                address: settings.address,

                defaultPrinterId: settings.defaultPrinterId

            });

        },

        test: async function (deviceId) {

            var res = await global.TM_PrintApi.testDevice(deviceId);

            if (!res.success) {

                notify(res.message || '测试失败', 'error');

                return;

            }

            var data = res.data || {};

            if (data.channel === 'CLOUD') {

                notify('云打印测试任务已发送', 'success');

            } else if (data.document && global.TM_Print && global.TM_Print.previewTestDocument) {

                global.TM_Print.previewTestDocument(data.document);

                notify('已打开浏览器测试页', 'success');

            } else {

                notify('测试任务已发送', 'success');

            }

        },

        setDefault: async function (deviceId) {

            var res = await global.TM_PrintApi.saveDevice({ isDefault: true }, deviceId);

            if (res.success) {

                await global.TM_PrintApi.saveSettings({ defaultPrinterId: deviceId });

                if (global.TM_Print && global.TM_Print.invalidateSettingsCache) global.TM_Print.invalidateSettingsCache();

                notify('已设为默认打印机', 'success');

                await renderList();

            } else notify(res.message || '设置失败', 'error');

        },

        remove: async function (deviceId) {

            if (!global.confirm('确定删除该打印机？')) return;

            var res = await global.TM_PrintApi.deleteDevice(deviceId);

            if (res.success) {

                notify('已删除', 'success');

                await renderList();

            } else notify(res.message || '删除失败', 'error');

        },

        showAddForm: function () {

            var body = document.getElementById('peripheral-settings-body');

            if (!body) return;

            var panel = document.createElement('section');

            panel.id = 'peripheral-add-panel';

            panel.className = 'rounded-xl border border-teal-100 bg-teal-50/30 p-3 space-y-2 text-xs';

            panel.innerHTML =

                '<p class="font-bold text-slate-700">添加云打印机</p>' +

                '<input id="pa-name" class="form-input form-input--compact w-full" placeholder="名称，如：前台热敏" value="前台热敏"/>' +

                '<select id="pa-vendor" class="form-input form-input--compact w-full">' +

                '<option value="FEIE">飞鹅云</option><option value="YILIAN">易联云</option></select>' +

                '<input id="pa-sn" class="form-input form-input--compact w-full" placeholder="机身 SN / 终端号"/>' +

                '<input id="pa-key" class="form-input form-input--compact w-full" placeholder="机身 KEY / 密钥"/>' +

                '<div class="flex gap-2">' +

                '<button type="button" class="tm-btn-secondary flex-1 py-2 text-xs font-bold" onclick="TM_Peripheral.cancelAdd()">取消</button>' +

                '<button type="button" class="tm-btn-primary flex-1 py-2 text-xs font-bold" onclick="TM_Peripheral.submitAdd()">保存</button></div>';

            body.appendChild(panel);

            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        },

        cancelAdd: function () {

            var p = document.getElementById('peripheral-add-panel');

            if (p) p.remove();

        },

        submitAdd: async function () {

            var name = (document.getElementById('pa-name') || {}).value;

            var vendor = (document.getElementById('pa-vendor') || {}).value || 'FEIE';

            var sn = (document.getElementById('pa-sn') || {}).value || '';

            var key = (document.getElementById('pa-key') || {}).value || '';

            if (!name || !sn) {

                notify('请填写名称与 SN', 'error');

                return;

            }

            var res = await global.TM_PrintApi.saveDevice({

                deviceName: name,

                deviceType: 'PRINTER',

                subType: 'THERMAL',

                connectionProtocol: 'CLOUD',

                vendor: vendor,

                isDefault: true,

                configJson: { cloudSn: sn, cloudKey: key }

            });

            if (res.success) {

                var deviceId = res.data && (res.data.deviceId || res.data.device_id);

                if (deviceId) {

                    await global.TM_PrintApi.saveSettings({ defaultPrinterId: deviceId });

                    if (global.TM_Print && global.TM_Print.invalidateSettingsCache) global.TM_Print.invalidateSettingsCache();

                }

                notify('打印机已添加', 'success');

                global.TM_Peripheral.cancelAdd();

                await renderList();

            } else notify(res.message || '添加失败', 'error');

        }

    };

})(window);

