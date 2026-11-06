// ============================================================
// 页面级 JS — 弹窗演示页交互逻辑
// 页面：pages/modal.html
// ============================================================

// ===== 弹窗基础交互 =====
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
  document.body.style.overflow = '';
}

function closeModalOnOverlay(event, modalId) {
  if (event.target === event.currentTarget) {
    closeModal(modalId);
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(function(modal) {
      modal.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
});

// ===== 通用菜单交互 =====
function switchSubmenuActive(element) {
  document.querySelectorAll('.submenu-item.active').forEach(function(item) {
    item.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-menu-item.has-active').forEach(function(item) {
    item.classList.remove('has-active');
  });
  element.classList.add('active');
  // ⭐ 设置父级2级菜单 has-active 高亮
  var innerLi = element.closest('li');
  var submenu = innerLi ? innerLi.parentElement : null;
  var outerLi = submenu ? submenu.parentElement : null;
  if (outerLi) {
    var parentMenu = outerLi.querySelector('.sidebar-menu-item');
    if (parentMenu) parentMenu.classList.add('has-active');
  }
}

function switchTopNavActive(element) {
  document.querySelectorAll('.nav-menu-item.active').forEach(function(item) {
    item.classList.remove('active');
  });
  element.classList.add('active');
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.sidebar-menu-item.expanded').forEach(function(item) {
    const submenu = item.nextElementSibling;
    if (submenu && submenu.classList.contains('submenu')) {
      submenu.style.display = 'block';
    }
  });
  document.querySelectorAll('.nav-menu-item').forEach(function(item) {
    item.addEventListener('click', function() { switchTopNavActive(this); });
  });
  // ⭐ 初始化默认菜单高亮：为已 active 的3级菜单设置父级2级菜单 has-active
  var activeItem = document.querySelector('.submenu-item.active');
  if (activeItem) {
    var innerLi = activeItem.closest('li');
    var submenu = innerLi ? innerLi.parentElement : null;
    var outerLi = submenu ? submenu.parentElement : null;
    if (outerLi) {
      var parentMenu = outerLi.querySelector('.sidebar-menu-item');
      if (parentMenu) parentMenu.classList.add('has-active');
    }
  }
});

// ===== 弹窗业务交互（IX7 表单保存校验+反馈） =====
function saveModal(modalId) {
  var requiredFields = document.querySelectorAll('#' + modalId + ' [required]');
  var isValid = true;
  requiredFields.forEach(function(field) {
    if (!field.value.trim()) {
      field.style.borderColor = 'var(--color-error)';
      isValid = false;
    } else {
      field.style.borderColor = '';
    }
  });
  if (!isValid) {
    alert('请填写所有必填项');
    return;
  }
  closeModal(modalId);
  alert('保存成功');
}

// ===== 富文本工具栏 & 附件上传交互（模拟） =====
function handleToolbarAction(btn) {
  var action = btn.getAttribute('title') || btn.textContent.trim();
  var editor = btn.closest('.rich-editor') && btn.closest('.rich-editor').querySelector('.rich-body');
  if (!editor) { alert('已应用「' + action + '」（模拟）'); return; }
  try { editor.focus(); document.execCommand('insertText', false, ''); } catch (e) {}
  editor.classList.toggle('toolbar-active-' + action);
  alert('已应用「' + action + '」（模拟）');
}

function handleFileUpload(btn) {
  var input = document.createElement('input');
  input.type = 'file';
  input.onchange = function() {
    var fileList = btn.nextElementSibling && btn.nextElementSibling.nextElementSibling;
    if (fileList && fileList.classList.contains('file-list') && input.files.length) {
      Array.prototype.forEach.call(input.files, function(f) {
        var item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = '<span class="file-name"><svg class="icon"><use href="#icon-file3"></use></svg>' + f.name + '</span><span class="file-remove"><svg class="icon"><use href="#icon-remove"></use></svg></span>';
        fileList.appendChild(item);
      });
      alert('已添加 ' + input.files.length + ' 个文件');
    } else {
      alert('上传文件（模拟）');
    }
  };
  input.click();
}

function handleAddMember(btn) {
  var subTable = btn.closest('.modal-section') || btn.closest('.sub-table-header');
  var tbody = subTable && subTable.querySelector('table tbody');
  if (!tbody) { alert('新增成员（模拟）'); return; }
  var newRow = tbody.querySelector('tr:first-child');
  if (!newRow) { alert('新增成员（模拟）'); return; }
  var clone = newRow.cloneNode(true);
  clone.querySelectorAll('input, select').forEach(function(el) { if (el.value) el.value = ''; });
  tbody.appendChild(clone);
  alert('已新增一行成员');
}

// ===== 弹窗内表单元素交互（模拟） =====
function handleDatePick(input) {
  var today = new Date();
  var y = today.getFullYear();
  var m = String(today.getMonth() + 1).padStart(2, '0');
  var d = String(today.getDate()).padStart(2, '0');
  var offset = input.placeholder === '结束日期' ? 7 : 0;
  var dt = new Date(today.getTime() + offset * 86400000);
  var py = dt.getFullYear();
  var pm = String(dt.getMonth() + 1).padStart(2, '0');
  var pd = String(dt.getDate()).padStart(2, '0');
  input.value = py + '-' + pm + '-' + pd;
  input.style.borderColor = 'var(--color-primary)';
  setTimeout(function() { input.style.borderColor = ''; }, 800);
}

function handleTimePick(input) {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var mi = String(now.getMinutes()).padStart(2, '0');
  input.value = h + ':' + mi;
  input.style.borderColor = 'var(--color-primary)';
  setTimeout(function() { input.style.borderColor = ''; }, 800);
}

function handleSelectChange(sel) {
  if (!sel.value) return;
  var label = sel.options[sel.selectedIndex].textContent;
  sel.style.borderColor = 'var(--color-primary)';
  setTimeout(function() { sel.style.borderColor = ''; }, 600);
}

// ===== 挂载到 window（供 onclick 调用） =====
window.openModal = openModal;
window.closeModal = closeModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.switchSubmenuActive = switchSubmenuActive;
window.switchTopNavActive = switchTopNavActive;
window.saveModal = saveModal;
window.handleToolbarAction = handleToolbarAction;
window.handleFileUpload = handleFileUpload;
window.handleAddMember = handleAddMember;
window.handleDatePick = handleDatePick;
window.handleTimePick = handleTimePick;
window.handleSelectChange = handleSelectChange;

// ============================================================
// 确认对话框交互（独立于弹窗，互不干扰）
// 详见 REFERENCES/components/confirm-dialog.md
// ============================================================

// 打开确认对话框
function openConfirm(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 关闭确认对话框
function closeConfirm(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}

// 点击遮罩关闭确认对话框
function closeConfirmOnOverlay(event, id) {
  if (event.target === event.currentTarget) {
    closeConfirm(id);
  }
}

// ESC 关闭所有确认对话框
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.confirm-overlay.show').forEach(function(dialog) {
      dialog.classList.remove('show');
    });
    document.body.style.overflow = '';
  }
});

// 确认回调（演示用：关闭对话框 + 提示反馈）
function handleConfirmCallback(id, message) {
  closeConfirm(id);
  alert(message);
}

// 挂载到 window
window.openConfirm = openConfirm;
window.closeConfirm = closeConfirm;
window.closeConfirmOnOverlay = closeConfirmOnOverlay;
window.handleConfirmCallback = handleConfirmCallback;
