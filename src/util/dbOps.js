import _ from 'lodash';
import dayjs from 'dayjs';
import promise from 'bluebird';
import Db from './db';
import cfg from '../cfg';
import { uuid } from './index';

const whereMethods = 'where,andWhere,orWhere,whereNot,orWhereNot,whereIn,orWhereIn,whereNotIn,orWhereNotIn,whereNull,orWhereNull,whereNotNull,orWhereNotNull,whereBetween,orWhereBetween,whereNotBetween,orWhereNotBetween'.split(
  ',',
); // ,whereExists
const db = new Db(cfg.db);

/**
 * 是否是高级where查询对象
 * @param arr
 * @returns {boolean}
 */
const isWhereMixed = obj => {
  return _.isPlainObject(obj) && _.every(obj, (v, k) => _.includes(whereMethods, k));
};

/**
 * 是否为高级查询数组
 * @param obj
 * @returns {*|boolean}
 */
const isWhereArrayMixed = obj => {
  return _.isArray(obj) && _.every(obj, v => isWhereMixed(v));
};

/**
 * 检查下条件是否为高级查询
 * @param {*}qb
 * @param {*}arr
 */
function whereMixed(qb, arr) {
  arr = _.castArray(arr);
  _.each(arr, whs => {
    // 是否是高级查询
    if (isWhereMixed(whs)) {
      _.each(whs, (v, k) => {
        if (isWhereMixed(v) || isWhereArrayMixed(v)) {
          qb[k](qb2 => whereMixed(qb2, v));
        } else {
          if (!_.includes(whereMethods, k)) {
            throw new Error(`where高级查询中出现未知操作方法:${k}`);
          }
          if (_.isArray(v)) {
            qb[k](...v);
          } else {
            qb[k](v);
          }
        }
      });
    } else {
      qb.where(whs);
    }
  });
}

function queryIds(qb, id, idName) {
  if (id) {
    if (_.isString(id)) {
      const ids = id.split(',');
      if (ids.length > 1) {
        qb.whereIn(idName, ids);
        return;
      }
    }
    qb.where({ [idName]: id });
  }
}

/**
 * 获取查询条件
 * @param query
 * @param cb  字段过滤或者结果处理(k===undefined)
 * @returns {*}
 */
const where = (model, queryRaw = {}, { idName = 'id', wh } = {}) => {
  const { pageSize, page, _fs, _ob = {}, id, ...query } = queryRaw;
  let md = model;
  // eslint-disable-next-line
  if (query._where) {
    // eslint-disable-next-line
    const whereQuery = _.isPlainObject(query._where) ? query._where : JSON.parse(query._where);
    md = md.query(qb => whereMixed(qb, whereQuery));
  }
  // eslint-disable-next-line
  delete query._where;
  if (wh) {
    md = wh(md);
  }
  md = md.query(qb => {
    queryIds(qb, id, idName);
    for (const key in _ob) {
      qb.orderBy(key, _ob[key] ? 'asc' : 'desc');
    }
    if (!_.isEmpty(query)) {
      qb.where(query);
    }
  });
  return md;
};

/**
 *
 * @param {*} model
 * @param {*} query
 * @param {*} cb
 * @param {*} idName
 */
const get = (model, query = {}, opts) => {
  query = query || {};
  const { pageSize, page, _fs, _getone, ...queryArgs } = query;
  const wh = where(model, queryArgs, opts);
  const columns = _fs ? (_.isString(_fs) ? _fs.split(',') : _fs) : '*';

  if (_getone) {
    return wh
      .fetch({
        columns,
      })
      .then(res => {
        if (res) {
          return {
            data: [res.toJSON()],
          };
        }
        return undefined;
      });
  } else if (pageSize && page) {
    return wh
      .fetchPage({
        pageSize,
        page,
        columns,
      })
      .then(res => {
        return {
          data: res.toJSON() || [],
          total: res.pagination.rowCount,
        };
      });
  } else {
    return wh
      .fetchAll({
        columns,
      })
      .then(res => {
        return {
          data: (res && res.toJSON()) || [],
        };
      });
  }
};

const getOne = (model, query, ...args) => get(model, { ...query, _getone: 1 }, ...args);

function defaultIdGenerate() {
  return uuid();
}

const defaultThen = id => id;

/**
 *
 * @param {*} data
 * @param {*} dateFs
 */
function dateConverts(data, dateFs, key) {
  if (!dateFs || !_.isArray(dateFs) || !dateFs.length) {
    return data;
  } else if (_.isPlainObject(data)) {
    return _.reduce(
      data,
      (r, v, k) => {
        r[k] = dateConverts(v, dateFs, k);
        return r;
      },
      {},
    );
  } else if (_.isArray(data)) {
    return _.map(data, i => dateConverts(i, dateFs));
  }
  if (key && _.includes(dateFs, key)) {
    return dayjs(data).toDate();
  }
  return data;
}

/**
 * 新建数据对象
 * @param model
 * @param data
 * @param idGenerate id生成器
 * @param idName
 */
const add = (model, data, { idGenerate = defaultIdGenerate, idName = 'id', then = defaultThen, dateFs } = {}) => {
  if (idGenerate && !data[idName]) {
    const id = idGenerate();
    data[idName] = id;
  }
  data = dateConverts(data, dateFs);
  // eslint-disable-next-line
  return new model()
    .save(data, {
      method: 'insert',
    })
    .then(res => {
      return then(res[idName], res);
    });
};

/**
 * 更新数据
 * @param {*} model
 * @param {*} data
 * @param {*} query 复合条件或id
 * @param {*} idName
 */
const edit = (model, data, { id, ...query } = {}, { idName = 'id', then = defaultThen, dateFs } = {}) => {
  id = id || data[idName];
  delete data[idName];
  if (id) {
    query.id = id;
  }
  if (_.isEmpty(query)) {
    throw '请输入编辑条件';
  }
  data = dateConverts(data, dateFs);
  return where(model, query, { idName })
    .save(data, {
      method: 'update',
    })
    .then(res => then(id, res));
};

/**
 * 删除
 * @param {*} model
 * @param {*} query 数据id或高级查询条件
 */
const del = (model, query = {}, { idName = 'id', then = defaultThen } = {}) => {
  if (_.isEmpty(query)) {
    throw '未知条件';
  }
  const { [idName]: id } = query;
  return where(model, query)
    .destroy()
    .then(res => then(id, res));
};

/**
 * 创建数据库常见操作
 * @param model
 * @param idGenerate id生成器
 * @param idName
 */
const createOps = (model, { idGenerate = defaultIdGenerate, idName = 'id', then = defaultThen, ob, dateFs } = {}) => {
  if (dateFs && !_.isArray(dateFs)) {
    dateFs = _.split(dateFs, ',');
  }
  return {
    get: (query, opts) => get(model, { _ob: ob, ...query }, { idName, ...opts }),
    getOne: (query, opts) => getOne(model, { _ob: ob, ...query }, { idName, ...opts }),
    add: data => add(model, data, { idGenerate, idName, then, dateFs }),
    edit: (data, query) => edit(model, data, query, { idName, then, dateFs }),
    del: query => del(model, query, { idName, then }),
    where: (...args) => where(...[model, ...args]),
    model,
  };
};

/**
 * 保存相关数据
 * @param promiseList
 * @param model
 * @param id
 * @param data
 * @param getQuery
 * @param compare
 * @param delQuery
 * @param addQuery
 */
const saveRelated = ({
  model,
  id,
  data,
  compare,
  getQuery,
  delQuery,
  addQuery,
  updateQuery,
  updateData,
  custom,
  dateFs,
}) => {
  return get(model, getQuery).then(({ data: dataRaw = [] }) => {
    const ps = [];

    if (delQuery) {
      // 查找需要删除的数据
      const dataDel = _.filter(dataRaw, item => {
        return !_.some(data, item2 => compare(item2, item));
      });
      // log.debug('dataDel--->', dataDel);
      // 删除
      const promiseDel = promise.map(dataDel, item => {
        return del(model, delQuery(item, id));
      });
      ps.push(promiseDel);
    }
    if (addQuery) {
      // 从数据中找出需要入库的新记录
      const dataNew = _.filter(data, item => {
        return !_.some(dataRaw, item2 => compare(item, item2));
      });
      // log.debug('dataNew--->', dataNew);
      // 添加
      const promiseAdd = promise.map(dataNew, item => {
        return add(model, addQuery(item, id), { dateFs });
      });
      ps.push(promiseAdd);
    }

    if (updateQuery) {
      // 从数据中找到要更新的新记录
      const dataUpdate = _.filter(data, item => {
        return _.some(dataRaw, item2 => compare(item, item2));
      });
      const promiseUpdate = promise.map(dataUpdate, item => {
        return edit(model, updateData ? updateData(item) : item, updateQuery(item, id), { dateFs });
      });
      ps.push(promiseUpdate);
    }
    if (custom) {
      custom({ data, dataRaw, ps });
    }
    return promise.all(ps);
  });
};

/**
 * 字段辅助
 * @param {*} obj  表
 */
const fields = (...args) => {
  const arr = _.reduce(
    args,
    (res, obj) => {
      if (_.isArray(obj)) {
        res.push(...obj);
      } else if (_.isObject(obj)) {
        _.each(obj, (val, table) => {
          if (val === '*') {
            res.push(`${table}.*`);
          } else {
            const fields = _.compact(_.isArray(val) ? val : _.split(val, ','));
            res.push(..._.map(fields, field => `${table}.${field}`));
          }
        });
      } else if (obj) {
        res.push(obj);
      }
      return res;
    },
    [],
  );
  return _.join(arr);
};

export default {
  db,
  where,
  get,
  getOne,
  add,
  edit,
  del,
  createOps,
  defaultThen,
  defaultIdGenerate,
  saveRelated,
  fields,
};
