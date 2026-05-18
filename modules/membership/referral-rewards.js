/**
 * 推荐奖励弹窗：名单 + 收款信息（对接 TenantService /referral/rewards、/user/payout-profile）
 */
(function () {
    var FRAGMENT_URL = '/modules/membership/referral-rewards-modal.html';
    var _htmlCache = null;
    var _panelData = null;
    var _payeeEditing = false;

    var PAYEE_LABELS = { wechat: '微信', alipay: '支付宝', bank: '银行卡' };

    function apiUrl(path) {
        if (typeof window.tmMemberApiUrl === 'function') return window.tmMemberApiUrl(path);
        return path;
    }

    function esc(s) {
        if (typeof window.tmEscapeHtml === 'function') return window.tmEscapeHtml(s);
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fmtDate(iso) {
        if (typeof window.tmFmtInviteDate === 'function') return window.tmFmtInviteDate(iso);
        if (!iso) return '—';
        try {
            var d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        } catch (e) {
            return '—';
        }
    }

    function maskAccountNo(no) {
        var s = String(no || '');
        if (s.length < 5) return s ? '****' : '';
        if (s.length <= 8) return s.slice(0, 2) + '****' + s.slice(-1);
        return s.slice(0, 4) + '****' + s.slice(-4);
    }

    function notify(msg) {
        if (typeof window.showNotification === 'function') window.showNotification(msg);
        else if (typeof window.showToast === 'function') window.showToast(msg);
        else alert(msg);
    }

    window.tmMountReferralRewardsModal = async function () {
        if (document.getElementById('referral-rewards-modal')) return;
        var legacy = document.getElementById('referral-list-modal');
        if (legacy) legacy.remove();
        if (!_htmlCache) {
            var res = await fetch(FRAGMENT_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('referral-rewards-modal.html load failed');
            _htmlCache = await res.text();
        }
        document.body.insertAdjacentHTML('beforeend', _htmlCache);
    };

    function validBadge(isValid) {
        if (isValid) {
            return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100"><i class="ph ph-check-circle"></i>是</span>';
        }
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">否</span>';
    }

    function renderReferralList(rows) {
        var tbody = document.getElementById('member-referral-list-tbody');
        var cards = document.getElementById('member-referral-list-cards');
        var empty = document.getElementById('member-referral-list-empty');
        var list = rows || [];
        if (empty) empty.classList.toggle('hidden', list.length > 0);
        if (!list.length) {
            if (tbody) tbody.innerHTML = '';
            if (cards) cards.innerHTML = '';
            return;
        }
        if (tbody) {
            tbody.innerHTML = list.map(function (r) {
                var hint = r.subscribedPending ? '<div class="text-[9px] text-slate-400 mt-0.5">已付费，待计入有效</div>' : '';
                return '<tr class="hover:bg-slate-50/80"><td class="px-6 py-3 font-bold text-slate-800">' + esc(r.refereeDisplayName || '—') +
                    '</td><td class="px-4 py-3 text-slate-500">' + esc(fmtDate(r.invitedAt)) +
                    '</td><td class="px-6 py-3 text-right">' + validBadge(!!r.validReferral) + hint + '</td></tr>';
            }).join('');
        }
        if (cards) {
            cards.innerHTML = list.map(function (r) {
                return '<div class="p-4 space-y-2"><div class="flex items-start justify-between gap-2"><p class="font-black text-slate-800">' +
                    esc(r.refereeDisplayName || '—') + '</p>' + validBadge(!!r.validReferral) +
                    '</div><p class="text-[10px] text-slate-500">注册 ' + esc(fmtDate(r.invitedAt)) +
                    '</p><p class="text-[10px] text-slate-500">' + esc(r.statusLabel || '') + '</p></div>';
            }).join('');
        }
    }

    function syncPayeeTypeButtons(type) {
        document.querySelectorAll('.member-payee-type-btn').forEach(function (btn) {
            var t = btn.getAttribute('data-payee-type');
            var active = t === type;
            btn.classList.toggle('border-[#14B8A6]', active);
            btn.classList.toggle('bg-teal-50', active);
            btn.classList.toggle('text-[#14B8A6]', active);
            btn.classList.toggle('border-slate-200', !active);
            btn.classList.toggle('text-slate-600', !active);
        });
    }

    function applyPayeeTypeFields(type) {
        var bankFields = document.getElementById('member-payee-bank-fields');
        var accountLabel = document.getElementById('member-payee-account-label');
        var accountInput = document.getElementById('member-payee-account');
        if (bankFields) bankFields.classList.toggle('hidden', type !== 'bank');
        if (accountLabel) {
            accountLabel.textContent = type === 'wechat' ? '微信号' : type === 'alipay' ? '支付宝账号' : type === 'bank' ? '银行卡号' : '收款账号';
        }
        if (accountInput) {
            accountInput.placeholder = type === 'bank' ? '请输入银行卡号' : type === 'wechat' ? '请输入微信号' : type === 'alipay' ? '请输入支付宝账号' : '请输入账号';
        }
    }

    window.memberPayeeSelectType = function (type) {
        syncPayeeTypeButtons(type);
        applyPayeeTypeFields(type);
    };

    function fillPayeeForm(p) {
        p = p || {};
        var type = p.accountType || '';
        memberPayeeSelectType(type);
        var nameEl = document.getElementById('member-payee-name');
        var accEl = document.getElementById('member-payee-account');
        var bankEl = document.getElementById('member-payee-bank-name');
        var branchEl = document.getElementById('member-payee-bank-branch');
        if (nameEl) nameEl.value = p.accountName || '';
        if (accEl) accEl.value = p.accountNo || '';
        if (bankEl) bankEl.value = p.bankName || '';
        if (branchEl) branchEl.value = p.bankBranch || '';
    }

    function renderPayeeSection() {
        var payee = (_panelData && _panelData.payout) || {};
        var saved = document.getElementById('member-payee-saved');
        var formWrap = document.getElementById('member-payee-form-wrap');
        var cancelBtn = document.getElementById('member-payee-cancel-btn');
        var hasSaved = !!payee.hasProfile;
        if (hasSaved && !_payeeEditing) {
            if (saved) saved.classList.remove('hidden');
            if (formWrap) formWrap.classList.add('hidden');
            var typeEl = document.getElementById('member-payee-saved-type');
            var nameEl = document.getElementById('member-payee-saved-name');
            var noEl = document.getElementById('member-payee-saved-no');
            var bankRow = document.getElementById('member-payee-saved-bank-row');
            var bankEl = document.getElementById('member-payee-saved-bank');
            var atEl = document.getElementById('member-payee-saved-at');
            if (typeEl) typeEl.textContent = PAYEE_LABELS[payee.accountType] || payee.accountType || '—';
            if (nameEl) nameEl.textContent = payee.accountName || '—';
            if (noEl) noEl.textContent = payee.accountNoMasked || maskAccountNo(payee.accountNo);
            if (bankRow) bankRow.classList.toggle('hidden', payee.accountType !== 'bank');
            if (bankEl) {
                bankEl.textContent = payee.accountType === 'bank'
                    ? ((payee.bankName || '') + (payee.bankBranch ? ' · ' + payee.bankBranch : ''))
                    : '';
            }
            if (atEl) atEl.textContent = payee.updatedAt ? fmtDate(String(payee.updatedAt).slice(0, 10)) : '—';
        } else {
            if (saved) saved.classList.add('hidden');
            if (formWrap) formWrap.classList.remove('hidden');
            if (cancelBtn) cancelBtn.classList.toggle('hidden', !hasSaved);
            fillPayeeForm({
                accountType: payee.accountType,
                accountName: payee.accountName,
                accountNo: payee.accountNo,
                bankName: payee.bankName,
                bankBranch: payee.bankBranch
            });
        }
    }

    function renderReferralPanel() {
        var d = _panelData || {};
        var rows = d.content || [];
        var qualified = d.qualifiedCount != null ? d.qualifiedCount : 0;
        var total = d.totalInvites != null ? d.totalInvites : rows.length;
        var code = d.referralCode || window._tmCachedReferralCode || '—';
        ['referral-modal-qualified', 'member-ref-stat-qualified'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = String(qualified);
        });
        var tEl = document.getElementById('member-ref-stat-total');
        if (tEl) tEl.textContent = String(total);
        var codeEl = document.getElementById('member-referral-tab-code');
        if (codeEl) codeEl.textContent = code;
        var inline = document.getElementById('referral-code');
        if (inline && code && code !== '—') inline.textContent = code;
        renderReferralList(rows);
        renderPayeeSection();
    }

    window.memberPayeeEnterEdit = function () {
        _payeeEditing = true;
        renderPayeeSection();
    };

    window.memberPayeeCancelEdit = function () {
        _payeeEditing = false;
        renderPayeeSection();
    };

    window.memberPayeeSave = async function () {
        var type = '';
        document.querySelectorAll('.member-payee-type-btn').forEach(function (btn) {
            if (btn.classList.contains('border-[#14B8A6]')) type = btn.getAttribute('data-payee-type') || '';
        });
        var name = (document.getElementById('member-payee-name') && document.getElementById('member-payee-name').value || '').trim();
        var accountNo = (document.getElementById('member-payee-account') && document.getElementById('member-payee-account').value || '').trim();
        var bankName = (document.getElementById('member-payee-bank-name') && document.getElementById('member-payee-bank-name').value || '').trim();
        var bankBranch = (document.getElementById('member-payee-bank-branch') && document.getElementById('member-payee-bank-branch').value || '').trim();
        var hint = document.getElementById('member-payee-form-hint');
        if (!type) { notify('请选择账户类型'); return; }
        if (!name) { notify('请填写收款户名'); return; }
        if (!accountNo) { notify('请填写收款账号'); return; }
        if (type === 'bank' && (!bankName || !bankBranch)) { notify('请填写开户银行与支行'); return; }
        var btn = document.getElementById('member-payee-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
        var payload = {
            accountType: type,
            payoutPayType: type,
            accountName: name,
            payoutAccountName: name,
            accountNo: accountNo,
            payoutAccountNo: accountNo,
            bankName: bankName,
            bankBranch: bankBranch,
            payoutBankName: type === 'bank' ? (bankName + '|' + bankBranch) : ''
        };
        var saveUrls = [
            '/api/v1/tenant/referral/save-payee',
            '/api/v1/tenant/referral/payout-profile',
            '/api/v1/tenant/user/payout-profile'
        ];
        try {
            var res = null;
            var data = {};
            for (var i = 0; i < saveUrls.length; i++) {
                var method = saveUrls[i].indexOf('user/payout') >= 0 ? 'PUT' : 'POST';
                res = await window.wrappedFetch(apiUrl(saveUrls[i]), {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                data = await res.json().catch(function () { return {}; });
                if (res.ok && data.success) break;
                if (res.status !== 404 && res.status !== 405) break;
            }
            if (!res || !res.ok || !data.success) {
                var msg = data.message || ('保存失败（HTTP ' + (res ? res.status : '?') + '）');
                if (res && (res.status === 404 || res.status === 405)) {
                    msg = '保存接口未就绪，请在 TenantService 目录执行 mvn clean spring-boot:run 后重试';
                }
                throw new Error(msg);
            }
            if (!_panelData) _panelData = {};
            _panelData.payout = data;
            _payeeEditing = false;
            if (hint) {
                hint.textContent = '保存成功';
                hint.classList.remove('hidden', 'text-red-500');
                hint.classList.add('text-emerald-600', 'font-bold');
                setTimeout(function () { hint.classList.add('hidden'); }, 2500);
            }
            renderPayeeSection();
            notify('收款信息已保存');
        } catch (e) {
            notify(e.message || '保存失败');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '保存收款信息'; }
        }
    };

    window.openReferralListModal = async function () {
        if (typeof window.injectMemberAuxModals === 'function') await window.injectMemberAuxModals();
        var modal = document.getElementById('referral-rewards-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        _payeeEditing = false;
        var tbody = document.getElementById('member-referral-list-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-slate-400">加载中…</td></tr>';
        try {
            var res = await window.wrappedFetch(apiUrl('/api/v1/tenant/referral/rewards?page=0&size=50'), { method: 'GET' });
            var data = await res.json().catch(function () { return {}; });
            if (!data.success) throw new Error(data.message || '加载失败');
            _panelData = data;
            if (data.referralCode) window._tmCachedReferralCode = data.referralCode;
            renderReferralPanel();
        } catch (e) {
            _panelData = { content: [], payout: {}, qualifiedCount: 0, totalInvites: 0 };
            renderReferralPanel();
            var empty = document.getElementById('member-referral-list-empty');
            if (empty) {
                empty.classList.remove('hidden');
                empty.textContent = e.message || '加载失败，请稍后重试';
            }
        }
    };

    window.closeReferralListModal = function () {
        var modal = document.getElementById('referral-rewards-modal');
        if (modal) modal.classList.add('hidden');
        var memberOpen = document.getElementById('member-modal') && !document.getElementById('member-modal').classList.contains('hidden');
        var subOpen = document.getElementById('subscription-modal') && !document.getElementById('subscription-modal').classList.contains('hidden');
        if (!memberOpen && !subOpen) document.body.style.overflow = '';
    };
})();
