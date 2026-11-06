// ============================================================
// 页面级 JS — 用户详情页交互逻辑
// 页面：pages/detail.html
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
 * 详情页业务交互（返回列表、编辑跳转）
 * ============================================================ */
function handleBack() {
  window.location.href = './list.html?embed=1';
}

function handleEdit() {
  var id = new URLSearchParams(location.search).get('id') || '';
  window.location.href = './form.html?id=' + id + '&embed=1';
}

var _deleteRowBtn = null;
function handleDeleteRow(btn) {
  _deleteRowBtn = btn;
  openConfirm('confirmDeleteRow');
}
function handleDeleteRowConfirm() {
  if (_deleteRowBtn) {
    var row = _deleteRowBtn.closest('tr');
    if (row) row.remove();
    _deleteRowBtn = null;
  }
  closeConfirm('confirmDeleteRow');
}

function handleEditRow(btn) {
  alert('编辑附件（模拟）');
}

function handleMoreAction(btn) {
  alert('更多操作（模拟）');
}

function switchTab(btn) {
  var tabs = btn.parentNode.querySelectorAll('.tab-item');
  tabs.forEach(function(t) { t.classList.remove('is-active'); });
  btn.classList.add('is-active');
}

document.addEventListener('DOMContentLoaded', function() {
  var backBtn = document.querySelector('.back-btn, .btn-secondary');
  if (backBtn) backBtn.addEventListener('click', handleBack);
  var editBtn = document.querySelector('.page-title-bar .btn-primary, .btn-primary');
  if (editBtn) editBtn.addEventListener('click', handleEdit);
});

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
window.handleDeleteRow = handleDeleteRow;
window.handleDeleteRowConfirm = handleDeleteRowConfirm;
