/**
 * bookshelf数据库工具封装
 */
import knex from 'knex';
import orm from 'bookshelf';
import transaction from 'bookshelf-transaction-manager';

function bindTo(src, method, dst, rename) {
  dst[rename || method] = src[method].bind(src);
}

/**
 * 数据库工具对象，一般一个应用（一个库）只需创建一个实例
 */
export default class DB {
  /**
   * 构造函数
   * @param config 数据库连接参数
   */
  constructor(config) {
    // 创建连接实例
    this._ = knex(config);
    this.db = orm(this._);

    // 添加常用插件
    ['registry', 'pagination', transaction].forEach(plugin => this.db.plugin(plugin));

    // 绑定常用操作
    bindTo(this.db.Model, 'extend', this, 'Model');
  }

  /**
   * 获取模型
   * @param model 模型名称
   * @return {*}
   */
  get(model) {
    return this.db.model(model);
  }

  /**
   * 创建模型并注册到全局
   * @param model 模型名称
   * @param modelCtor 模型创建参数
   * @param staticProps 静态属性？
   * @return {*}
   */
  set(modelName, modelCtor, staticProps) {
    if (modelCtor === undefined) {
      modelCtor = modelName;
    }
    if (typeof modelCtor === 'string') {
      modelCtor = { tableName: modelCtor };
    }
    if (!modelCtor.tableName) {
      if (typeof modelCtor.table === 'string') {
        modelCtor.tableName = modelCtor.table;
        delete modelCtor.table;
      } else {
        modelCtor.tableName = modelName;
      }
    }
    if (typeof modelCtor.id === 'string') {
      // 用id简化idAttribute的拼写
      if (modelCtor.idAttribute === undefined) {
        modelCtor.idAttribute = modelCtor.id;
      }
      delete modelCtor.id;
    }
    return this.db.model(modelName, modelCtor, staticProps);
  }

  /**
   * 创建模型实例
   * @param model 模型名称（已注册）
   * @param attributes 实例属性（字段）
   * @param options 其它选项
   * @return {*}
   */
  create(model, attributes, options) {
    const Model = this.db.model(model);
    return new Model(attributes, options);
  }

  /**
   * 执行数据库操作（封装事务）
   * @param model （主）模型名称（可以为空）
   * @param action 数据库操作回调（model, collection, transaction）
   */
  exec(model, action) {
    if (typeof model === 'function') {
      // 参数顺序可以互换
      const x = action;
      action = model;
      model = x;
    }
    return this.db.withTransaction(({ model: m, collection: c, transaction: t }) =>
      action(typeof model === 'string' ? m(model) : m, c, t),
    );
  }
}
