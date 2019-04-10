import dbOps from 'util/dbOps';
import _ from 'lodash';
import promise from 'bluebird';
import { apiServer } from './core';

const { db, createOps, get } = dbOps;
export const projectOps = createOps(db.set('project'));
export const datatypeOps = createOps(db.set('datatype'));
export const projectStatusOps = createOps(db.set('project_status'));
export const projectDataOps = createOps(db.set('project_data'));
export const projectLogOps = createOps(db.set('project_log'));

/**
 * 项目获取
 * @param {*} query
 */
export const projectGet = query => {
  return projectOps.get(query);
};
/**
 * 项目添加
 * @param {*} data
 */
export const projectAdd = data => {
  const { datatypes } = data;
  return projectOps.add({ ...data, status: '0', createTime: new Date() }).then(projectId => {
    const datatypeList = JSON.parse(datatypes) || [];
    return promise.map(datatypeList, datatype => {
      return projectStatusOps.add({ projectId, datatype, status: '0' });
    });
  });
};
/**
 * 项目编辑
 * @param {*} data
 */
export const projectEdit = data => {
  const { datatypes, id: projectId } = data;
  return projectOps.edit(data).then(() => {
    return projectStatusOps.del({ projectId }).then(() => {
      const datatypeList = JSON.parse(datatypes) || [];
      return promise.map(datatypeList, datatype => {
        return projectStatusOps.add({ projectId, datatype, status: '0' });
      });
    });
  });
};
/**
 * 项目删除
 * @param {*} data
 */
export const projectDel = data => {
  return projectOps.edit({ ...data, status: 'd' });
};
/**
 * 数据类型查询
 * @param {*} query
 */
export const datatypeGet = query => {
  return datatypeOps.get({ ...query, _ob: { displayorder: 1 }, status: '1' });
};
/**
 * 查看项目的数据类型
 * @param {*} query
 */
export const projectStatusGet = query => {
  const { projectId, ...args } = query;
  const wh = projectStatusOps.model.query(qb => {
    qb.leftJoin('datatype', 'datatype.code', 'project_status.datatype');
    qb.leftJoin('project_data', function() {
      this.on('project_data.projectId', '=', 'project_status.projectId').andOn(
        'project_data.datatype',
        '=',
        'project_status.datatype',
      );
    });
    qb.where('project_status.projectId', projectId);
  });
  const fs = 'project_status.*, datatype.name, project_data.editor, project_data.checker';
  return get(wh, { _fs: fs, ...args });
};
/**
 * 数据导入
 * @param {*} data
 */
export const importData = data => {
  // 对data进行处理后 操作数据库
  const { projectId, datatype, data: datas } = data || {};
  const importData = _.map(datas, v => {
    const { 编码: code, '* 内容': name } = v;
    return {
      code,
      name,
    };
  });
  // 过滤name为空的数据
  let importDatas = _.filter(importData, v => v.name);
  // 去重
  importDatas = _.uniqBy(importDatas, 'name');
  return db.exec(() => {
    return projectDataOps
      .get({ projectId, datatype })
      .then(({ data }) => {
        if (!_.isEmpty(data)) {
          // 删除已有数据
          return projectDataOps.del({ projectId, datatype });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        const promiseList = [];
        _.each(importDatas, v => {
          promiseList.push(
            projectDataOps.add({
              projectId,
              datatype,
              code: v.code,
              name: v.name,
              // 初始未关联
              editStatus: '0',
              checkStatus: '0',
            }),
          );
        });
        return Promise.all(promiseList).then(() => {
          return { msg: '导入成功' };
        });
      });
  });
};
/** 检查导入数据 */
export const checkImportData = (getModel, data) => {
  const { projectId, datatype, data: datas } = data || {};
  const importData = _.map(datas, v => {
    const { 编码: code, '* 内容': name } = v;
    return {
      code,
      name,
    };
  });
  return Promise.all([projectDataOps.get({ projectId, datatype })]).then(res => {
    const [{ data: projectDatas }] = res;
    const err = [];
    _.each(importData, (v, index) => {
      // 内容验证
      if (!v.name) {
        err.push({ rowNum: `第${index + 2}行`, errMsg: '内容未填写' });
      }
      if (_.find(projectDatas, { name: v.name })) {
        err.push({ rowNum: `第${index + 2}行`, errMsg: '内容已存在' });
      }
    });
    return { err, importData };
  });
};
/**
 * 获取站内数据
 * @param {*} query
 */
export const projectStationGet = query => {
  const projectId = '88888888888888888888888888888888';
  return projectDataOps.get({ ...query, projectId, checkStatus: '1', _fs: 'pcode,code,name' });
};
/**
 * 获取第三方数据
 * @param {*} query
 * status false(修订或关联),true提交
 *
 */
export const projectDataGet = query => {
  // 判断是否有拒绝的(有拒绝只能修订,只有通过或忽略可以发布)
  const { projectId = '', datatype = '', _status, ...temp } = query;
  // _status: 1编辑状态,2审核状态
  return projectDataOps.get({ ...temp, projectId, datatype }).then(({ data: dataList = [] }) => {
    if (!_status) {
      return { data: dataList };
    } else {
      let args = {};
      if (_status === '1') {
        args = {
          projectId,
          datatype,
          editStatus: '0',
        };
      } else if (_status === '2') {
        args = {
          projectId,
          datatype,
          _where: JSON.stringify([{ whereIn: ['project_data.checkStatus', ['0', '2']] }]),
        };
      }
      const wh = projectDataOps.model.query(qb => {
        qb.count('id as cid');
      });
      return get(wh, { _fs: 'id', ...args }).then(({ data: refuseList = [] }) => {
        let status = false;
        const { cid = 0 } = _.head(refuseList) || {};
        if (cid === 0 && !_.isEmpty(dataList)) {
          status = true;
        }
        return { status, data: dataList };
      });
    }
  });
};
/**
 * editStatus(0未关联,1关联,2异常)
 * checkStatus(1通过,2拒绝,3忽略)
 * 第三方数据处理
 * @param {*} data
 */
export const projectDataEdit = data => {
  const { _status = '', userId, ...args } = data;
  // 是编辑人
  if (_status === '1') {
    // 关联时更新时间
    return projectDataOps.edit({ ...args, editor: userId, createTime: new Date() });
  }
  // 审核人
  return projectDataOps.edit({ ...args, checker: userId });
};
/**
 * 审核状态(0.草稿状态(默认), 1.审核中, 2.修订中, 3.已发布)
 * @param {*} data
 */
export const projectStatusEdit = data => {
  return projectStatusOps.edit(data);
};
/**
 * 日志添加
 * @param {*} data
 */
export const projectLogAdd = data => {
  const { userId } = data;
  return apiServer.get('/base/user', { id: userId, _fs: 'id,username' }).then(({ data: [user = {}] = [] }) => {
    const { username } = user;
    return projectLogOps.add({ ...data, userName: username, createTime: new Date() });
  });
};
/**
 * 日志获取
 * @param {*} query
 */
export const projectLogGet = query => {
  return projectLogOps.get(query);
};
