# -*- coding: utf-8 -*-
import pathlib

p = pathlib.Path(__file__).resolve().parents[1] / "assets" / "js" / "auth.js"
lines = p.read_text(encoding="utf-8").splitlines(True)

# Replace lines 751-754 (1-based) -> index 750-753
acc_marker = '<div id=\\"member-accounts-manage-modal\\"'
line753 = lines[752]
idx = line753.index(acc_marker)
accounts_escaped = line753[idx: line753.rindex('");')]

new_block = [
    "window.injectMemberAuxModals = async function () {\n",
    "    if (typeof window.tmMountReferralRewardsModal === 'function') {\n",
    "        await window.tmMountReferralRewardsModal();\n",
    "    }\n",
    "    if (document.getElementById('member-accounts-manage-modal')) return;\n",
    "    document.body.insertAdjacentHTML('beforeend', \"" + accounts_escaped + "\");\n",
    "};\n",
    "\n",
]
lines[750:754] = new_block

text = "".join(lines)
marker = "window.openReferralListModal = async function ()"
if marker in text:
    o_start = text.index(marker)
    c_start = text.index("window.closeReferralListModal = function ()", o_start)
    c_end = text.index("};", c_start) + 2
    text = (
        text[:o_start]
        + "/* openReferralListModal / closeReferralListModal -> modules/membership/referral-rewards.js */\n\n"
        + text[c_end + 1 :]
    )

p.write_text(text, encoding="utf-8")
print("patched ok")
