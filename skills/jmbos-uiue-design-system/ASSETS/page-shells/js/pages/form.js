// ============================================================
// 页面级 JS — 新增用户页交互逻辑
// 页面：pages/form.html
// ============================================================

/* ============================================================
 * 通用菜单交互（IX8/IX9/IX10）
 * ============================================================ */
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

/* ============================================================
 * 表单页业务交互（IX7 保存校验+反馈，取消返回）
 * ============================================================ */
function handleFormSave() {
  var requiredFields = document.querySelectorAll('[required]');
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
  alert('保存成功');
  window.location.href = './list.html?embed=1';
}

function handleFormCancel() {
  openConfirm('confirmCancel');
}
function handleCancelConfirm() {
  closeConfirm('confirmCancel');
  window.location.href = './list.html?embed=1';
}

function handleSubmit() {
  var requiredFields = document.querySelectorAll('[required]');
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
  alert('提交成功');
  window.location.href = './list.html?embed=1';
}

document.addEventListener('DOMContentLoaded', function() {
  var saveBtn = document.querySelector('.form-footer .btn-primary');
  if (saveBtn) saveBtn.addEventListener('click', handleFormSave);
  var cancelBtn = document.querySelector('.form-footer .btn-secondary');
  if (cancelBtn) cancelBtn.addEventListener('click', handleFormCancel);
});

/* ============================================================
 * 富文本工具栏 & 附件上传交互（模拟）
 * ============================================================ */
function handleToolbarAction(btn) {
  var action = btn.getAttribute('title') || btn.textContent.trim();
  var editor = btn.closest('.rich-editor') && btn.closest('.rich-editor').querySelector('.rich-body');
  if (!editor) return;
  try {
    editor.focus();
    document.execCommand('insertText', false, '');
  } catch (e) {}
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
  var subTable = btn.closest('.sub-table');
  var tbody = subTable && subTable.querySelector('table tbody');
  if (!tbody) { alert('新增成员（模拟）'); return; }
  var newRow = tbody.querySelector('tr:first-child');
  if (!newRow) { alert('新增成员（模拟）'); return; }
  var clone = newRow.cloneNode(true);
  clone.querySelectorAll('input, select').forEach(function(el) { if (el.value) el.value = ''; });
  tbody.appendChild(clone);
  alert('已新增一行成员');
}

/* ============================================================
 * 确认对话框交互
 * ============================================================ */
function openConfirm(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeConfirm(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}
function closeConfirmOnOverlay(event, id) {
  if (event.target === event.currentTarget) closeConfirm(id);
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.confirm-overlay.show').forEach(function(d) { d.classList.remove('show'); });
    document.body.style.overflow = '';
  }
});
window.openConfirm = openConfirm;
window.closeConfirm = closeConfirm;
window.closeConfirmOnOverlay = closeConfirmOnOverlay;
window.handleFormCancel = handleFormCancel;
window.handleCancelConfirm = handleCancelConfirm;
