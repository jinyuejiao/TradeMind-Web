/**
 * 规格属性模板管理弹窗：系统内置模板 + 商户定制（fork 保存）
 */
(function () {
    'use strict';
    var PM = window.ProductModule;
    if (!PM) return;

    PM._attrTplModalState = PM._attrTplModalState || {
        templates: [],
        selectedId: null,
        definitions: [],
        editingName: '',
        isSystem: false,
        sourceTemplateId: null
    };

    function escAttr(s) {
        return PM.escHtmlAttr ? PM.escHtmlAttr(s) : String(s == null ? '' : s);
    }
    function escText(s) {
        return PM.escHtmlText ? PM.escHtmlText(s) : String(s == null ? '' : s);
    }
    function notify(msg, type) {
        if (window.TM_UI && window.TM_UI.showNotification) {
            window.TM_UI.showNotification(msg, type || 'info');
        }
    }

    PM.resolveEffectiveTemplateId = PM.resolveEffectiveTemplateId || function (templateId) {
        if (!templateId) return null;
        var list = PM._attributeTemplateListCache || [];
        var fork = list.find(function (t) {
            var src = t.source_template_id != null ? t.source_template_id : t.sourceTemplateId;
            return src != null && String(src) === String(templateId);
        });
        if (fork) return fork.template_id != null ? fork.template_id : fork.templateId;
        return templateId;
    };

    PM.invalidateAttributeTemplateCache = PM.invalidateAttributeTemplateCache || function () {
        PM._attributeTemplateListCache = null;
        if (window.TM_MasterDataCache && typeof window.TM_MasterDataCache.invalidateTemplates === 'function') {
            window.TM_MasterDataCache.invalidateTemplates();
        }
    };

    function parseEnumValues(raw) {
        if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
        if (typeof raw === 'string') {
            return raw.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        }
        return [];
    }

    function renderTemplateList() {
        var box = document.getElementById('tm-attr-tpl-list');
        if (!box) return;
        var st = PM._attrTplModalState;
        var list = st.templates || [];
        if (!list.length) {
            box.innerHTML = '<p class="text-xs text-slate-400 px-2 py-4 text-center">暂无模板</p>';
            return;
        }
        var systemRows = [];
        var tenantRows = [];
        list.forEach(function (t) {
            var isSystem = t.is_system === true || t.isSystem === true;
            var tid = t.template_id != null ? t.template_id : t.templateId;
            var src = t.source_template_id != null ? t.source_template_id : t.sourceTemplateId;
            if (isSystem && PM.resolveEffectiveTemplateId(tid) !== tid) {
                return;
            }
            if (isSystem) systemRows.push(t);
            else if (!src) tenantRows.push(t);
            else tenantRows.push(t);
        });
        function rowHtml(t, badge) {
            var tid = t.template_id != null ? t.template_id : t.templateId;
            var effectiveId = PM.resolveEffectiveTemplateId(tid);
            var on = String(st.selectedId) === String(effectiveId) || String(st.selectedId) === String(tid);
            var count = t.attr_count != null ? t.attr_count : (t.attrCount != null ? t.attrCount : '');
            return '<button type="button" class="tm-attr-tpl-list-item w-full text-left px-3 py-2.5 rounded-xl border transition '
                + (on ? 'border-brand-300 bg-brand-50' : 'border-transparent hover:bg-slate-50')
                + '" data-tid="' + escAttr(String(tid)) + '">'
                + '<div class="flex items-center justify-between gap-2">'
                + '<span class="text-xs font-bold text-slate-700 truncate">' + escText(t.name || ('模板#' + tid)) + '</span>'
                + (badge ? ('<span class="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ' + badge.cls + '">' + escText(badge.text) + '</span>') : '')
                + '</div>'
                + (count !== '' ? ('<p class="text-[10px] text-slate-400 mt-0.5">' + count + ' 个属性</p>') : '')
                + '</button>';
        }
        var html = '';
        if (systemRows.length) {
            html += '<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1">系统内置</p>';
            html += systemRows.map(function (t) {
                return rowHtml(t, { text: '内置', cls: 'bg-slate-100 text-slate-500' });
            }).join('');
        }
        if (tenantRows.length) {
            html += '<p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-3 pb-1">商户模板</p>';
            html += tenantRows.map(function (t) {
                var src = t.source_template_id != null ? t.source_template_id : t.sourceTemplateId;
                var badge = src ? { text: '已定制', cls: 'bg-brand-100 text-brand-700' } : { text: '自定义', cls: 'bg-emerald-50 text-emerald-600' };
                return rowHtml(t, badge);
            }).join('');
        }
        box.innerHTML = html;
        box.querySelectorAll('.tm-attr-tpl-list-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tid = parseInt(btn.getAttribute('data-tid'), 10);
                if (!isNaN(tid)) PM.selectAttributeTemplateInModal(tid);
            });
        });
    }

    function renderDefinitionEditor() {
        var box = document.getElementById('tm-attr-tpl-defs');
        var titleEl = document.getElementById('tm-attr-tpl-editor-title');
        var st = PM._attrTplModalState;
        if (titleEl) {
            titleEl.textContent = st.editingName || '选择左侧模板';
        }
        if (!box) return;
        if (!st.selectedId) {
            box.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">请从左侧选择模板，或新建通用模板</p>';
            return;
        }
        var defs = st.definitions || [];
        var html = defs.map(function (def, idx) {
            var vals = parseEnumValues(def.enumValues || def.enum_values || def.values).join(',');
            return '<div class="tm-attr-tpl-def-row rounded-xl border border-slate-100 p-3 space-y-2" data-idx="' + idx + '">'
                + '<div class="flex items-center gap-2">'
                + '<input type="text" class="tm-attr-tpl-def-name form-input flex-1 text-xs py-1.5" placeholder="属性名，如：颜色" value="' + escAttr(def.name || '') + '" />'
                + '<button type="button" class="tm-attr-tpl-def-del text-[10px] text-red-400 font-bold px-2 shrink-0" data-idx="' + idx + '">删除</button>'
                + '</div>'
                + '<input type="text" class="tm-attr-tpl-def-values form-input w-full text-xs py-1.5" placeholder="取值，逗号分隔，如：红,黑,白" value="' + escAttr(vals) + '" />'
                + '</div>';
        }).join('');
        box.innerHTML = html
            + '<button type="button" id="tm-attr-tpl-add-def" class="w-full mt-2 py-2.5 rounded-xl border border-dashed border-brand-200 text-brand-600 text-xs font-bold hover:bg-brand-50">+ 添加规格属性</button>';
        box.querySelectorAll('.tm-attr-tpl-def-del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-idx'), 10);
                if (!isNaN(i)) {
                    PM.syncAttributeTemplateDefsFromDom();
                    st.definitions.splice(i, 1);
                    renderDefinitionEditor();
                }
            });
        });
        var addBtn = document.getElementById('tm-attr-tpl-add-def');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                if ((st.definitions || []).length >= 5) {
                    notify('单模板最多 5 个规格属性', 'warning');
                    return;
                }
                PM.syncAttributeTemplateDefsFromDom();
                st.definitions.push({ name: '', enumValues: [] });
                renderDefinitionEditor();
            });
        }
    }

    PM.syncAttributeTemplateDefsFromDom = function () {
        var box = document.getElementById('tm-attr-tpl-defs');
        var st = PM._attrTplModalState;
        if (!box || !st.selectedId) return;
        var defs = [];
        box.querySelectorAll('.tm-attr-tpl-def-row').forEach(function (row) {
            var nameInp = row.querySelector('.tm-attr-tpl-def-name');
            var valInp = row.querySelector('.tm-attr-tpl-def-values');
            var name = nameInp ? String(nameInp.value || '').trim() : '';
            var vals = valInp ? parseEnumValues(valInp.value) : [];
            if (!name) return;
            defs.push({ name: name, enumValues: vals, attrType: 'ENUM' });
        });
        st.definitions = defs;
    };

    PM.selectAttributeTemplateInModal = async function (templateId) {
        var st = PM._attrTplModalState;
        if (st.selectedId) {
            PM.syncAttributeTemplateDefsFromDom();
        }
        st.selectedId = templateId;
        renderTemplateList();
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates/' + templateId, { method: 'GET' });
            var data = await window.handleApiResponse(resp);
            var detail = data && data.data ? data.data : data;
            if (!detail) {
                notify('加载模板失败', 'error');
                return;
            }
            st.editingName = detail.name || '';
            st.isSystem = detail.is_system === true || detail.isSystem === true;
            st.sourceTemplateId = detail.source_template_id != null ? detail.source_template_id : detail.sourceTemplateId;
            st.definitions = (detail.definitions || []).map(function (d) {
                return {
                    name: d.name || '',
                    enumValues: PM.resolveDefinitionEnumValues ? PM.resolveDefinitionEnumValues(d) : (d.enumValues || [])
                };
            });
            renderDefinitionEditor();
        } catch (e) {
            notify('加载模板失败', 'error');
        }
    };

    PM.openAttributeTemplateModal = async function () {
        var modal = document.getElementById('attribute-template-modal');
        if (!modal && typeof TM_syncProductCenterOverlays === 'function') {
            try {
                await TM_syncProductCenterOverlays();
            } catch (e) { /* ignore */ }
            modal = document.getElementById('attribute-template-modal');
        }
        if (!modal) {
            notify('模板管理弹窗未加载，请刷新页面', 'warning');
            return;
        }
        PM._attrTplModalState.selectedId = null;
        PM._attrTplModalState.definitions = [];
        PM._attrTplModalState.editingName = '';
        try {
            var iv = PM.getIndustryVertical ? PM.getIndustryVertical() : 'GENERAL';
            var url = '/api/v1/rd/products/attribute-templates';
            if (iv && iv !== 'GENERAL') url += '?industryVertical=' + encodeURIComponent(iv);
            var resp = await window.wrappedFetch(url, { method: 'GET' });
            var res = await resp.json().catch(function () { return {}; });
            PM._attrTplModalState.templates = res && res.success && Array.isArray(res.data) ? res.data : [];
            PM._attributeTemplateListCache = PM._attrTplModalState.templates.slice();
            renderTemplateList();
            renderDefinitionEditor();
            var curTpl = PM.el('detail-variant-template');
            var curId = curTpl && curTpl.value ? parseInt(curTpl.value, 10) : null;
            if (curId && !isNaN(curId)) {
                await PM.selectAttributeTemplateInModal(curId);
            } else if (PM._attrTplModalState.templates.length) {
                var first = PM._attrTplModalState.templates[0];
                var fid = first.template_id != null ? first.template_id : first.templateId;
                await PM.selectAttributeTemplateInModal(fid);
            }
        } catch (e) {
            notify('加载模板列表失败', 'error');
        }
        if (typeof window.TM_openUnifiedModal === 'function') {
            window.TM_openUnifiedModal(modal, { variant: 'sheet' });
        } else {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
        PM.bindAttributeTemplateModalUi();
    };

    PM.closeAttributeTemplateModal = function () {
        var modal = document.getElementById('attribute-template-modal');
        if (!modal) return;
        if (typeof window.TM_closeUnifiedModal === 'function') {
            window.TM_closeUnifiedModal(modal);
        } else {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    };

    PM.saveAttributeTemplateModal = async function () {
        var st = PM._attrTplModalState;
        if (st.selectedId === 'new') {
            await PM.saveNewAttributeTemplate();
            return;
        }
        if (!st.selectedId) {
            notify('请先选择模板', 'warning');
            return;
        }
        PM.syncAttributeTemplateDefsFromDom();
        if (!st.definitions.length) {
            notify('请至少保留一个规格属性', 'warning');
            return;
        }
        var invalid = st.definitions.find(function (d) { return !d.name || !parseEnumValues(d.enumValues).length; });
        if (invalid) {
            notify('请填写完整的属性名与取值', 'warning');
            return;
        }
        var payload = {
            templateId: st.selectedId,
            name: st.editingName || '规格模板',
            definitions: st.definitions.map(function (d) {
                return {
                    name: d.name,
                    enumValues: parseEnumValues(d.enumValues),
                    attrType: 'ENUM'
                };
            })
        };
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await window.handleApiResponse(resp);
            if (!data || data.success === false) {
                if (resp.status !== 500 && resp.status !== 401) {
                    notify((data && data.message) || '保存失败', 'error');
                }
                return;
            }
            var saved = data.data || data;
            var newId = saved.templateId != null ? saved.templateId : (saved.template_id != null ? saved.template_id : st.selectedId);
            PM.invalidateAttributeTemplateCache();
            if (typeof PM.loadAttributeTemplates === 'function') {
                await PM.loadAttributeTemplates(true);
            }
            var tplSel = PM.el('detail-variant-template');
            if (tplSel && newId) {
                tplSel.value = String(newId);
            }
            if (typeof PM.loadVariantMatrixFromTemplate === 'function' && newId) {
                await PM.loadVariantMatrixFromTemplate(newId, { force: true, preserve: true });
                if (typeof PM.rebuildVariantSelectionFromComboDraft === 'function') {
                    PM.rebuildVariantSelectionFromComboDraft();
                }
            }
            if (typeof PM.renderVariantModalTemplateIntoModal === 'function') {
                PM.renderVariantModalTemplateIntoModal();
            }
            notify(st.isSystem ? '已保存为商户专属模板' : '模板已保存', 'success');
            PM.closeAttributeTemplateModal();
        } catch (e) {
            notify((e && e.message) || '保存失败', 'error');
        }
    };

    PM.createBlankAttributeTemplate = function () {
        var st = PM._attrTplModalState;
        st.selectedId = 'new';
        st.editingName = '新建通用模板';
        st.isSystem = false;
        st.definitions = [{ name: '颜色', enumValues: ['红', '黑', '白'] }];
        var panel = document.getElementById('tm-attr-tpl-new-panel');
        if (panel) panel.classList.remove('hidden');
        var nameInp = document.getElementById('tm-attr-tpl-new-name');
        if (nameInp) nameInp.value = '';
        renderTemplateList();
        renderDefinitionEditor();
    };

    PM.saveNewAttributeTemplate = async function () {
        var st = PM._attrTplModalState;
        PM.syncAttributeTemplateDefsFromDom();
        var nameInp = document.getElementById('tm-attr-tpl-new-name');
        var name = nameInp ? String(nameInp.value || '').trim() : '';
        if (!name) {
            notify('请填写模板名称', 'warning');
            return;
        }
        if (!st.definitions.length) {
            notify('请至少添加一个规格属性', 'warning');
            return;
        }
        var iv = PM.getIndustryVertical ? PM.getIndustryVertical() : null;
        var payload = {
            name: name,
            industryVertical: iv && iv !== 'GENERAL' ? iv : null,
            definitions: st.definitions.map(function (d) {
                return { name: d.name, enumValues: parseEnumValues(d.enumValues), attrType: 'ENUM' };
            })
        };
        try {
            var resp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var data = await window.handleApiResponse(resp);
            if (!data) {
                notify('创建失败', 'error');
                return;
            }
            var saved = data.data || data;
            var newId = saved.templateId != null ? saved.templateId : saved.template_id;
            PM.invalidateAttributeTemplateCache();
            if (typeof PM.loadAttributeTemplates === 'function') {
                await PM.loadAttributeTemplates(true);
            }
            var iv2 = PM.getIndustryVertical ? PM.getIndustryVertical() : 'GENERAL';
            var listResp = await window.wrappedFetch('/api/v1/rd/products/attribute-templates'
                + (iv2 && iv2 !== 'GENERAL' ? ('?industryVertical=' + encodeURIComponent(iv2)) : ''), { method: 'GET' });
            var listRes = await listResp.json().catch(function () { return {}; });
            st.templates = listRes && listRes.success && Array.isArray(listRes.data) ? listRes.data : [];
            PM._attributeTemplateListCache = st.templates.slice();
            var panel = document.getElementById('tm-attr-tpl-new-panel');
            if (panel) panel.classList.add('hidden');
            if (newId) {
                await PM.selectAttributeTemplateInModal(newId);
            }
            var tplSel = PM.el('detail-variant-template');
            if (tplSel && newId) tplSel.value = String(newId);
            notify('通用模板已创建', 'success');
        } catch (e) {
            notify('创建失败', 'error');
        }
    };

    PM.bindAttributeTemplateModalUi = function () {
        var newBtn = document.getElementById('tm-attr-tpl-new-btn');
        if (newBtn && !newBtn.__tmBound) {
            newBtn.__tmBound = true;
            newBtn.addEventListener('click', function () {
                PM.createBlankAttributeTemplate();
            });
        }
    };

    window.openAttributeTemplateModal = function () {
        if (PM.openAttributeTemplateModal) PM.openAttributeTemplateModal();
    };
    window.closeAttributeTemplateModal = function () {
        if (PM.closeAttributeTemplateModal) PM.closeAttributeTemplateModal();
    };
    window.saveAttributeTemplateModal = function () {
        if (PM.saveAttributeTemplateModal) PM.saveAttributeTemplateModal();
    };
})();
