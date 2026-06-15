/**
 * 客户档案表单 — CRM 新增/编辑弹窗与工作台待确认单据客户 Tab 共用
 */
(function (global) {
    'use strict';

    var FRAGMENT_URL = '/modules/fragments/customer-registry-form.html?v=20260527crf';
    var FIELD_IDS = ['cust-id', 'cust-name', 'cust-phone', 'cust-email', 'cust-region', 'cust-address', 'cust-summary'];

    function resolveRoot(root) {
        if (root && root.nodeType === 1) return root;
        return document.getElementById('crm-customer-registry-root')
            || document.getElementById('audit-customer-registry-root')
            || document;
    }

    function fieldEl(root, id) {
        root = resolveRoot(root);
        if (root.id === id) return root;
        return root.querySelector ? root.querySelector('#' + id) : document.getElementById(id);
    }

    function setFieldValue(root, id, value) {
        var el = fieldEl(root, id);
        if (!el) return;
        el.value = value == null ? '' : String(value);
    }

    function getFieldValue(root, id) {
        var el = fieldEl(root, id);
        return el ? String(el.value || '').trim() : '';
    }

    function normalizeAiCustomer(raw) {
        if (!raw || typeof raw !== 'object') raw = {};
        return {
            id: raw.id != null ? raw.id : (raw.cust_id != null ? raw.cust_id : (raw.custId != null ? raw.custId : '')),
            name: raw.name || raw.customer_name || raw.customerName || raw.matched_customer_name || '',
            phone: raw.phone || raw.mobile || raw.tel || '',
            email: raw.email || '',
            region: raw.region || '',
            address: raw.address || '',
            summary: raw.summary || raw.note || raw.description || ''
        };
    }

    function buildPrefillFromAudit(aiStructured) {
        var data = aiStructured && typeof aiStructured === 'object' ? aiStructured : {};
        var list = Array.isArray(data.new_customers_found) ? data.new_customers_found : [];
        var first = list[0] || {};
        var customerData = data.customer_data && typeof data.customer_data === 'object' ? data.customer_data : {};
        var merged = normalizeAiCustomer(Object.assign({}, customerData, first));
        if (!merged.name) {
            merged.name = customerData.matched_customer_name || customerData.name || '';
        }
        return merged;
    }

    function collapseAdvanced(root) {
        root = resolveRoot(root);
        var drawer = fieldEl(root, 'advanced-drawer');
        var icon = fieldEl(root, 'advanced-icon');
        if (drawer) {
            drawer.classList.add('hidden');
            drawer.classList.remove('open');
        }
        if (icon) {
            icon.classList.remove('ph-caret-up');
            icon.classList.add('ph-caret-down');
        }
    }

    function expandAdvanced(root) {
        root = resolveRoot(root);
        var drawer = fieldEl(root, 'advanced-drawer');
        var icon = fieldEl(root, 'advanced-icon');
        if (drawer) {
            drawer.classList.remove('hidden');
            drawer.classList.add('open');
        }
        if (icon) {
            icon.classList.remove('ph-caret-down');
            icon.classList.add('ph-caret-up');
        }
    }

    function toggleAdvanced(root) {
        root = resolveRoot(root);
        var drawer = fieldEl(root, 'advanced-drawer');
        if (!drawer) return;
        if (drawer.classList.contains('hidden')) {
            expandAdvanced(root);
        } else {
            collapseAdvanced(root);
        }
    }

    function bindToggle(root) {
        root = resolveRoot(root);
        var btn = root.querySelector('[data-tm-cust-toggle-advanced]');
        if (!btn || btn.dataset.tmCustBound === '1') return;
        btn.dataset.tmCustBound = '1';
        btn.addEventListener('click', function (event) {
            event.preventDefault();
            toggleAdvanced(root);
        });
    }

    function fillForm(root, data) {
        root = resolveRoot(root);
        var normalized = normalizeAiCustomer(data);
        setFieldValue(root, 'cust-id', normalized.id || '');
        setFieldValue(root, 'cust-name', normalized.name || '');
        setFieldValue(root, 'cust-phone', normalized.phone || '');
        setFieldValue(root, 'cust-email', normalized.email || '');
        setFieldValue(root, 'cust-region', normalized.region || '');
        setFieldValue(root, 'cust-address', normalized.address || '');
        setFieldValue(root, 'cust-summary', normalized.summary || '');

        var hasAdvanced = !!(normalized.email || normalized.region || normalized.address || normalized.summary);
        if (hasAdvanced) {
            expandAdvanced(root);
        } else {
            collapseAdvanced(root);
        }
        return normalized;
    }

    function resetForm(root) {
        root = resolveRoot(root);
        FIELD_IDS.forEach(function (id) {
            setFieldValue(root, id, '');
        });
        collapseAdvanced(root);
    }

    function readPayload(root) {
        root = resolveRoot(root);
        var phone = getFieldValue(root, 'cust-phone');
        return {
            name: getFieldValue(root, 'cust-name'),
            phone: phone || null,
            email: getFieldValue(root, 'cust-email'),
            region: getFieldValue(root, 'cust-region'),
            address: getFieldValue(root, 'cust-address'),
            summary: getFieldValue(root, 'cust-summary')
        };
    }

    function readPayloadWithMeta(root, meta) {
        var payload = readPayload(root);
        meta = meta || {};
        payload.source = meta.source || 'OTHER';
        return payload;
    }

    function mount(container, options) {
        options = options || {};
        if (!container) return Promise.reject(new Error('客户档案表单容器不存在'));
        if (container.dataset.tmCustMounted === '1') {
            if (options.initialData) fillForm(container, options.initialData);
            return Promise.resolve(container);
        }
        return fetch(FRAGMENT_URL, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('加载客户档案表单失败: ' + res.status);
                return res.text();
            })
            .then(function (html) {
                container.innerHTML = html;
                container.dataset.tmCustMounted = '1';
                bindToggle(container);
                if (options.initialData) fillForm(container, options.initialData);
                return container;
            });
    }

    global.TmCustomerRegistry = {
        mount: mount,
        fill: fillForm,
        reset: resetForm,
        readPayload: readPayload,
        readPayloadWithMeta: readPayloadWithMeta,
        toggleAdvanced: toggleAdvanced,
        normalizeAiCustomer: normalizeAiCustomer,
        buildPrefillFromAudit: buildPrefillFromAudit
    };
})(window);
