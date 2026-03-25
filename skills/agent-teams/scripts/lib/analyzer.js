/**
 * Agent Teams - 依赖分析器
 *
 * 分析任务依赖关系，生成并行执行组
 */

const { DEPENDENCY_TYPES, PARALLEL_STRATEGY } = require('./constants');

class DependencyAnalyzer {
  constructor() {
    this.dag = {};
    this.parallelGroups = [];
  }

  /**
   * 分析任务依赖
   * @param {Array} tasks - 任务列表
   * @returns {object} 分析结果
   */
  analyze(tasks) {
    // 构建DAG
    this.dag = this._buildDAG(tasks);

    // 计算并行执行组
    this.parallelGroups = this._computeParallelGroups(tasks);

    // 计算关键路径
    const criticalPath = this._computeCriticalPath(tasks);

    // 检测冲突
    const conflicts = this._detectConflicts(tasks);

    return {
      dag: this.dag,
      parallel_groups: this.parallelGroups,
      critical_path: criticalPath,
      conflicts: conflicts,
      total_phases: this.parallelGroups.length
    };
  }

  /**
   * 构建依赖图
   */
  _buildDAG(tasks) {
    const dag = {};

    for (const task of tasks) {
      dag[task.id] = {
        task: task,
        dependencies: task.depends_on || [],
        dependents: []
      };
    }

    // 填充反向依赖
    for (const task of tasks) {
      for (const depId of (task.depends_on || [])) {
        if (dag[depId]) {
          dag[depId].dependents.push(task.id);
        }
      }
    }

    return dag;
  }

  /**
   * 计算并行执行组
   */
  _computeParallelGroups(tasks) {
    const groups = [];
    const completed = new Set();
    const remaining = new Set(tasks.map(t => t.id));

    while (remaining.size > 0) {
      // 找出所有依赖已满足的任务
      const ready = [];
      for (const taskId of remaining) {
        const task = tasks.find(t => t.id === taskId);
        const deps = task.depends_on || [];

        if (deps.every(d => completed.has(d))) {
          ready.push(task);
        }
      }

      if (ready.length === 0) {
        // 存在循环依赖，强制选择剩余任务
        const taskId = remaining.values().next().value;
        const task = tasks.find(t => t.id === taskId);
        ready.push(task);
      }

      // 检查ready任务是否可以并行
      const parallelReady = this._checkParallelizable(ready);

      groups.push({
        group_id: groups.length + 1,
        tasks: parallelReady.map(t => ({
          id: t.id,
          name: t.name,
          agent: t.agent,
          scope: t.scope
        })),
        strategy: parallelReady.length > 1 ? PARALLEL_STRATEGY.MAX_PARALLEL : PARALLEL_STRATEGY.SERIAL
      });

      // 更新状态
      for (const task of parallelReady) {
        completed.add(task.id);
        remaining.delete(task.id);
      }
    }

    return groups;
  }

  /**
   * 检查任务是否可以并行
   */
  _checkParallelizable(tasks) {
    if (tasks.length <= 1) return tasks;

    // 按scope分组
    const scopeGroups = {};
    for (const task of tasks) {
      const scope = task.scope || 'default';
      if (!scopeGroups[scope]) {
        scopeGroups[scope] = [];
      }
      scopeGroups[scope].push(task);
    }

    // 检查同scope内的任务
    const result = [];
    for (const [scope, group] of Object.entries(scopeGroups)) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        // 同scope的多个developer任务需要检查文件冲突
        const developers = group.filter(t => t.agent === 'developer' || t.type === 'develop');
        const others = group.filter(t => t.agent !== 'developer' && t.type !== 'develop');

        // 如果有多个developer操作同一scope，需要串行
        if (developers.length > 1) {
          // 按任务顺序执行
          result.push(...developers);
        } else {
          result.push(...developers);
        }

        result.push(...others);
      }
    }

    return tasks; // 默认返回所有
  }

  /**
   * 计算关键路径
   */
  _computeCriticalPath(tasks) {
    const longestPath = [];
    let maxLength = 0;

    const findPath = (taskId, path) => {
      const node = this.dag[taskId];
      if (!node) return;

      const newPath = [...path, taskId];

      if (node.dependents.length === 0) {
        if (newPath.length > maxLength) {
          maxLength = newPath.length;
          longestPath.splice(0, longestPath.length, ...newPath);
        }
        return;
      }

      for (const depId of node.dependents) {
        findPath(depId, newPath);
      }
    };

    // 从无依赖的任务开始
    for (const task of tasks) {
      if ((task.depends_on || []).length === 0) {
        findPath(task.id, []);
      }
    }

    return longestPath;
  }

  /**
   * 检测冲突
   */
  _detectConflicts(tasks) {
    const conflicts = [];

    // 检查文件冲突
    const fileMap = {};
    for (const task of tasks) {
      if (task.agent === 'developer' && task.scope) {
        if (fileMap[task.scope]) {
          conflicts.push({
            type: 'file_conflict',
            tasks: [fileMap[task.scope], task.id],
            scope: task.scope,
            resolution: 'serial'
          });
        } else {
          fileMap[task.scope] = task.id;
        }
      }
    }

    return conflicts;
  }

  /**
   * 获取可执行的任务
   * @param {Array} tasks - 所有任务
   * @param {Set} completed - 已完成的任务ID
   * @returns {Array} 可执行的任务
   */
  getExecutableTasks(tasks, completed) {
    return tasks.filter(task => {
      const deps = task.depends_on || [];
      return deps.every(d => completed.has(d)) && !completed.has(task.id);
    });
  }

  /**
   * 判断依赖类型
   */
  getDependencyType(task, dependency) {
    // 硬依赖：明确在depends_on中
    if ((task.depends_on || []).includes(dependency.id)) {
      return DEPENDENCY_TYPES.HARD;
    }

    // 无依赖：不同阶段且无直接关联
    if (task.phase && dependency.phase && task.phase !== dependency.phase) {
      return DEPENDENCY_TYPES.NONE;
    }

    // 软依赖：同阶段或有潜在关联
    return DEPENDENCY_TYPES.SOFT;
  }
}

module.exports = {
  DependencyAnalyzer
};