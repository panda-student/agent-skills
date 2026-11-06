// ============================================================
// 页面级 JS — 用户列表页交互逻辑
// 页面：pages/list.html
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

// 通用菜单初始化（原 DOMContentLoaded，动态加载时直接执行）
(function initMenu() {
  document.querySelectorAll('.sidebar-menu-item.expanded').forEach(function(item) {
    var submenu = item.nextElementSibling;
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
})();

/* ============================================================
 * 列表页业务交互（IX1~IX6 轻模拟）
 * ============================================================ */
var MOCK_DATA = [
  { id: '1', roleName: '超级管理员', status: '启用', regionCode: 'CN-350500', phone: '13800138001', address: '福建省泉州市南安市经济开发区九牧工业园' },
  { id: '2', roleName: '运营经理', status: '启用', regionCode: 'CN-350200', phone: '13800138002', address: '福建省厦门市思明区软件园二期' },
  { id: '3', roleName: '区域督导', status: '启用', regionCode: 'CN-310100', phone: '13800138003', address: '上海市浦东新区张江高科技园区' },
  { id: '4', roleName: '内容编辑', status: '启用', regionCode: 'CN-440100', phone: '13800138004', address: '广东省广州市天河区珠江新城' },
  { id: '5', roleName: '财务审核员', status: '启用', regionCode: 'CN-330100', phone: '13800138005', address: '浙江省杭州市余杭区文一西路' },
  { id: '6', roleName: '渠道分销', status: '禁用', regionCode: 'CN-510100', phone: '13800138006', address: '四川省成都市高新区天府大道' },
  { id: '7', roleName: '门店店长', status: '启用', regionCode: 'CN-320100', phone: '13800138007', address: '江苏省南京市鼓楼区中山北路' },
  { id: '8', roleName: '售后专员', status: '启用', regionCode: 'CN-420100', phone: '13800138008', address: '湖北省武汉市江汉区解放大道' },
  { id: '9', roleName: '仓管员', status: '禁用', regionCode: 'CN-370100', phone: '13800138009', address: '山东省济南市历下区经十路' },
  { id: '10', roleName: '数据分析师', status: '启用', regionCode: 'CN-110100', phone: '13800138010', address: '北京市朝阳区建国路88号' },
  { id: '11', roleName: '客服主管', status: '启用', regionCode: 'CN-440300', phone: '13800138011', address: '广东省深圳市南山区科技园' },
  { id: '12', roleName: '采购员', status: '启用', regionCode: 'CN-610100', phone: '13800138012', address: '陕西省西安市雁塔区高新路' },
  { id: '13', roleName: '审计员', status: '禁用', regionCode: 'CN-500100', phone: '13800138013', address: '重庆市渝中区解放碑步行街' },
  { id: '14', roleName: '市场推广', status: '启用', regionCode: 'CN-330200', phone: '13800138014', address: '浙江省宁波市鄞州区钟公庙' },
  { id: '15', roleName: '访客观察', status: '启用', regionCode: 'CN-350100', phone: '13800138015', address: '福建省福州市鼓楼区五四路' }
];

function showLoading() {
  var tbody = document.querySelector('.data-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="99" style="text-align:center;padding:32px;color:var(--color-text-secondary);">加载中...</td></tr>';
}

function renderTable(data) {
  var tbody = document.querySelector('.data-table tbody');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="99" style="text-align:center;padding:32px;color:var(--color-text-secondary);">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function(row) {
    return '<tr>' +
      '<td class="checkbox-cell"><input type="checkbox" value="' + row.id + '"></td>' +
      '<td>' + row.id + '</td>' +
      '<td>' + row.roleName + '</td>' +
      '<td><span class="tag tag-' + (row.status === '启用' ? 'success' : 'default') + '">' + row.status + '</span></td>' +
      '<td>' + row.regionCode + '</td>' +
      '<td>' + row.phone + '</td>' +
      '<td class="ellipsis-cell" title="' + row.address + '">' + row.address + '</td>' +
      '<td class="action-col">' +
        renderActionLinks(row.id) +
      '</td>' +
      '</tr>';
  }).join('');
}

/* ⭐ 操作列渲染逻辑（规范 tables.md）：
 * - 操作总数 ≤ 3：全部用文字按钮显示
 * - 操作总数 > 3：前2个文字按钮 + 更多图标（第3个起收进下拉菜单）
 */
var ROW_ACTIONS = [
  { name: '编辑', handler: 'handleEdit' },
  { name: '查看', handler: 'handleView' },
  { name: '删除', handler: 'handleDelete' },
  { name: '复制', handler: 'handleCopy' },
  { name: '导出', handler: 'handleExportRow' }
];
var ACTION_THRESHOLD = 3;                          /* ⭐ 阈值：>3 时触发更多 */

function renderActionLinks(id) {
  var html = '<div class="action-links">';
  if (ROW_ACTIONS.length <= ACTION_THRESHOLD) {
    ROW_ACTIONS.forEach(function(act) {
      html += '<button class="link-btn" onclick="' + act.handler + '(\'' + id + '\')">' + act.name + '</button>';
    });
  } else {
    for (var i = 0; i < 2; i++) {
      html += '<button class="link-btn" onclick="' + ROW_ACTIONS[i].handler + '(\'' + id + '\')">' + ROW_ACTIONS[i].name + '</button>';
    }
    // ⭐ 用 div 容器包裹图标按钮和下拉菜单（HTML 不允许 button 嵌套 button）
    html += '<div class="more-action-wrap">' +
      '<button class="more-action-btn" title="更多操作" onclick="toggleActionDropdown(event, \'' + id + '\')">' +
        '<svg class="icon"><use href="#icon-more"></use></svg>' +
      '</button>' +
      '<div class="action-dropdown" id="dropdown-' + id + '">';
    for (var j = 2; j < ROW_ACTIONS.length; j++) {
      html += '<button class="action-dropdown-item" onclick="' + ROW_ACTIONS[j].handler + '(\'' + id + '\'); closeAllDropdowns()">' + ROW_ACTIONS[j].name + '</button>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

function toggleActionDropdown(event, id) {
  event.stopPropagation();
  var dropdown = document.getElementById('dropdown-' + id);
  if (!dropdown) return;
  var isOpen = dropdown.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) dropdown.classList.add('show');
}

function closeAllDropdowns() {
  document.querySelectorAll('.action-dropdown.show').forEach(function(d) {
    d.classList.remove('show');
  });
}

// ⭐ 全局点击关闭下拉菜单 — 使用捕获阶段避免与下拉菜单项的 onclick 冲突
document.addEventListener('click', function(e) {
  // 如果点击来源在下拉菜单内部，不执行关闭（让菜单项的 onclick 先完成）
  if (e.target.closest('.more-action-wrap')) return;
  closeAllDropdowns();
});

// IX1 查询
function handleSearch() {
  showLoading();
  setTimeout(function() { renderTable(MOCK_DATA); }, 800);
}

// IX2 重置
function handleReset() {
  document.querySelectorAll('.query-input, .query-select').forEach(function(el) {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  showLoading();
  setTimeout(function() { renderTable(MOCK_DATA); }, 500);
}

// IX3 新增（打开内联弹窗，不跳转）
function handleAdd() {
  openRoleModal(null);
}

// IX4 编辑/查看（打开内联弹窗，不跳转）
function handleEdit(id) {
  openRoleModal(id);
}
// IX4 查看（打开抽屉详情，不跳转）
function handleView(id) {
  openDetailDrawer(id);
}

// IX5 删除（二次确认）
var _deleteId = null;
function handleDelete(id) {
  _deleteId = id;
  var row = MOCK_DATA.find(function(item) { return item.id === id; });
  var label = row ? row.roleName : id;
  var desc = document.getElementById('confirmDeleteDesc');
  if (desc) desc.textContent = '确认删除角色「' + label + '」（ID: ' + id + '）吗？删除后数据将无法恢复。';
  openConfirm('confirmDelete');
}
function handleDeleteConfirm() {
  if (_deleteId !== null) {
    MOCK_DATA = MOCK_DATA.filter(function(item) { return item.id !== _deleteId; });
    updateTotalCount();
    renderTable(MOCK_DATA);
    _deleteId = null;
  }
  closeConfirm('confirmDelete');
}

// 更新总数显示
function updateTotalCount() {
  var el = document.getElementById('totalCount');
  if (el) el.textContent = MOCK_DATA.length;
}

// IX6 分页
function handlePageChange(btn) {
  // 排除非数字按钮（上一页/下一页/省略号含 icon，不设 active）
  if (btn.querySelector('.icon')) return;
  // 排除 disabled 按钮
  if (btn.disabled) return;

  document.querySelectorAll('.page-btn.active').forEach(function(item) {
    item.classList.remove('active');
  });
  btn.classList.add('active');

  // 更新上一页/下一页 disabled 状态
  var prevBtn = document.querySelector('.page-btn[title="上一页"]');
  var nextBtn = document.querySelector('.page-btn[title="下一页"]');
  var currentPage = parseInt(btn.textContent.trim(), 10);

  // 获取所有数字按钮的最大页码
  var maxPage = 1;
  document.querySelectorAll('.page-btn').forEach(function(b) {
    var num = parseInt(b.textContent.trim(), 10);
    if (!isNaN(num) && num > maxPage) maxPage = num;
  });

  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= maxPage);
}

// IX7 批量删除
function handleBatchDelete() {
  var checked = document.querySelectorAll('.data-table input[type="checkbox"]:checked');
  if (checked.length === 0) {
    alert('请先选择要删除的记录');
    return;
  }
  var desc = document.getElementById('confirmBatchDeleteDesc');
  if (desc) desc.textContent = '将删除选中的 ' + checked.length + ' 条记录，此操作不可撤销。';
  openConfirm('confirmBatchDelete');
}
function handleBatchDeleteConfirm() {
  var checked = document.querySelectorAll('.data-table input[type="checkbox"]:checked');
  var count = checked.length;
  MOCK_DATA = MOCK_DATA.filter(function(item) {
    return !Array.from(checked).some(function(c) { return c.value == item.id; });
  });
  updateTotalCount();
  renderTable(MOCK_DATA);
  closeConfirm('confirmBatchDelete');
  alert('已删除 ' + count + ' 条记录');
}

// IX8 批量编辑
function handleBatchEdit() {
  var checked = document.querySelectorAll('.data-table input[type="checkbox"]:checked');
  if (checked.length === 0) {
    alert('请先选择要编辑的记录');
    return;
  }
  if (checked.length > 1) {
    alert('一次只能编辑一条记录，请重新选择');
    return;
  }
  var id = checked[0].value;
  openRoleModal(id);
}

// IX9 导出
function handleExport() {
  alert('正在导出数据，请稍候...（模拟）');
}

// IX10 导入
function handleImport() {
  alert('请选择要导入的文件...（模拟）');
}

// IX11 更多操作
function handleMoreActions() {
  alert('更多操作菜单（模拟）');
}

// IX12 表格行更多操作
function handleMore(id) {
  alert('行 ' + id + ' 更多操作（模拟）');
}
function handleCopy(id) {
  var row = MOCK_DATA.find(function(item) { return item.id === id; });
  alert('已复制角色「' + (row ? row.roleName : id) + '」（模拟）');
}
function handleExportRow(id) {
  var row = MOCK_DATA.find(function(item) { return item.id === id; });
  alert('已导出角色「' + (row ? row.roleName : id) + '」（模拟）');
}

/* ============================================================
 * 内联弹窗控制（新增/编辑角色，不跳转页面）
 * ============================================================ */
var _editingId = null;

function openRoleModal(id) {
  _editingId = id;
  var titleEl = document.getElementById('roleModalTitle');
  if (id) {
    var row = MOCK_DATA.find(function(item) { return item.id === id; });
    titleEl.textContent = row ? '编辑角色（' + row.roleName + '）' : '编辑角色';
    document.getElementById('field-roleName').value = row ? row.roleName : '';
    document.getElementById('field-status').value = row ? row.status : '启用';
    document.getElementById('field-regionCode').value = row ? row.regionCode : '';
    document.getElementById('field-phone').value = row ? row.phone : '';
    document.getElementById('field-address').value = row ? row.address : '';
  } else {
    titleEl.textContent = '新增角色';
    ['field-roleName', 'field-regionCode', 'field-phone', 'field-address'].forEach(function(fid) {
      document.getElementById(fid).value = '';
    });
    document.getElementById('field-status').value = '启用';
  }
  document.getElementById('roleModal').classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function closeModalOnOverlay(event, modalId) {
  if (event.target === event.currentTarget) closeModal(modalId);
}

function saveRoleModal() {
  var roleName = document.getElementById('field-roleName').value.trim();
  if (!roleName) {
    alert('请填写角色名称');
    document.getElementById('field-roleName').focus();
    return;
  }
  var data = {
    roleName: roleName,
    status: document.getElementById('field-status').value,
    regionCode: document.getElementById('field-regionCode').value.trim() || '-',
    phone: document.getElementById('field-phone').value.trim() || '-',
    address: document.getElementById('field-address').value.trim() || '-'
  };
  if (_editingId) {
    var idx = MOCK_DATA.findIndex(function(item) { return item.id === _editingId; });
    if (idx > -1) {
      MOCK_DATA[idx] = Object.assign({}, MOCK_DATA[idx], data);
      alert('已更新角色「' + roleName + '」');
    }
  } else {
    var newId = String(MOCK_DATA.length + 1);
    MOCK_DATA.push(Object.assign({ id: newId }, data));
    updateTotalCount();
    alert('已新增角色「' + roleName + '」');
  }
  closeModal('roleModal');
  renderTable(MOCK_DATA);
}

/* ============================================================
 * 抽屉详情控制（查看角色，从右侧滑入）
 * ============================================================ */
function openDetailDrawer(id) {
  var row = MOCK_DATA.find(function(item) { return item.id === id; });
  var body = document.getElementById('drawerBody');
  if (!row) {
    body.innerHTML = '<p style="color:var(--color-text-secondary);text-align:center;padding:40px 0;">未找到数据</p>';
  } else {
    var statusTag = '<span class="tag tag-' + (row.status === '启用' ? 'success' : 'default') + '">' + row.status + '</span>';
    body.innerHTML =
      '<div class="detail-section">' +
        '<h3 class="detail-section-title">基本信息</h3>' +
        '<div class="detail-grid">' +
          '<div class="detail-item"><div class="detail-label">角色ID</div><div class="detail-value">' + row.id + '</div></div>' +
          '<div class="detail-item"><div class="detail-label">角色名称</div><div class="detail-value">' + row.roleName + '</div></div>' +
          '<div class="detail-item"><div class="detail-label">状态</div><div class="detail-value">' + statusTag + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-section">' +
        '<h3 class="detail-section-title">联系信息</h3>' +
        '<div class="detail-grid">' +
          '<div class="detail-item"><div class="detail-label">区域代码</div><div class="detail-value">' + row.regionCode + '</div></div>' +
          '<div class="detail-item"><div class="detail-label">手机号</div><div class="detail-value">' + row.phone + '</div></div>' +
          '<div class="detail-item"><div class="detail-label">详细地址</div><div class="detail-value">' + row.address + '</div></div>' +
        '</div>' +
      '</div>';
  }
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('detailDrawer').classList.add('show');
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('detailDrawer').classList.remove('show');
}

// 尺寸切换：放大→全屏，缩小→800px（规范见 drawer.md）
function toggleDrawerSize() {
  var drawer = document.getElementById('detailDrawer');
  var btn = drawer.querySelector('.drawer-toggle');
  if (drawer.classList.contains('drawer-fullscreen')) {
    drawer.classList.remove('drawer-fullscreen');
    btn.title = '放大';
    btn.innerHTML = '<svg class="icon"><use href="#icon-goaway"></use></svg>';
  } else {
    drawer.classList.add('drawer-fullscreen');
    btn.title = '缩小';
    btn.innerHTML = '<svg class="icon"><use href="#icon-towards"></use></svg>';
  }
}

/* ============================================================
 * 确认对话框交互
 * ============================================================ */
function openConfirm(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeConfirm(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
}
function closeConfirmOnOverlay(event, id) {
  if (event.target === event.currentTarget) closeConfirm(id);
}

// ============================================================
// 初始化
// ============================================================
renderTable(MOCK_DATA);

// ESC 键关闭弹窗/抽屉/确认对话框
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModal('roleModal');
    closeDrawer();
    closeAllDropdowns();
    document.querySelectorAll('.confirm-overlay.show').forEach(function(d) { d.classList.remove('show'); });
    document.body.style.overflow = '';
  }
});

/* ============================================================
 * ⭐ 全局函数暴露 — 确保内联 onclick 可访问所有函数
 * ============================================================ */
window.switchSubmenuActive = switchSubmenuActive;
window.switchTopNavActive = switchTopNavActive;
window.handleSearch = handleSearch;
window.handleReset = handleReset;
window.handleAdd = handleAdd;
window.handleEdit = handleEdit;
window.handleView = handleView;
window.handleDelete = handleDelete;
window.handleDeleteConfirm = handleDeleteConfirm;
window.handleBatchDelete = handleBatchDelete;
window.handleBatchDeleteConfirm = handleBatchDeleteConfirm;
window.handleBatchEdit = handleBatchEdit;
window.handleExport = handleExport;
window.handleImport = handleImport;
window.handleMoreActions = handleMoreActions;
window.handlePageChange = handlePageChange;
window.handleMore = handleMore;
window.handleCopy = handleCopy;
window.handleExportRow = handleExportRow;
window.toggleActionDropdown = toggleActionDropdown;
window.closeAllDropdowns = closeAllDropdowns;
window.openRoleModal = openRoleModal;
window.closeModal = closeModal;
window.closeModalOnOverlay = closeModalOnOverlay;
window.saveRoleModal = saveRoleModal;
window.openDetailDrawer = openDetailDrawer;
window.closeDrawer = closeDrawer;
window.toggleDrawerSize = toggleDrawerSize;
window.openConfirm = openConfirm;
window.closeConfirm = closeConfirm;
window.closeConfirmOnOverlay = closeConfirmOnOverlay;
