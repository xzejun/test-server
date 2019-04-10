import _ from 'lodash';
import cfg from 'cfg';
import log from 'util/log';
import { createMethod } from 'util/request';

const { apikey, apiUrl, fileServers } = cfg;

/**
 * 默认处理
 * @param {*} ctx
 */
export const proxyThen = ({ err, data } = {}) => {
  if (err) {
    log.error(err);
    throw 'server err';
  } else {
    return data;
  }
};

export const createMethods = (...argDef) => {
  const proxy = mothod => (...args) => createMethod(mothod, ...argDef)(...args).then(proxyThen);
  return {
    get: proxy('get'),
    post: proxy('post'),
    del: proxy('delete'),
    put: proxy('put'),
  };
};

/**
 * 文件服务
 */
export const fileServer = createMethods(
  url => {
    const fileHost = fileServers.hosts[_.random(0, fileServers.hosts.length - 1)];
    return `http://${fileHost}${url}?token=${fileServers.token}`;
  },
  {
    error: res => {
      log.error('fileServer host error', res);
    },
    options: {
      headers: {
        apikey,
      },
    },
  },
);

/**
 * 文件标记
 * @param {*} ids
 */
export const fileMarked = ids => ids && fileServer.put(`/${ids}`);

/**
 * 文件删除
 * @param {*} ids
 */
export const fileDel = ids => ids && fileServer.del(`/${ids}`);

/**
 * 文件原数据(支持批量,以逗号隔开)
 * @param {*} ids
 */
export const fileMeta = ids => ids && fileServer.get(`/meta/${ids}`);

/**
 * 文件原文件
 * @param {*} id
 */
export const fileRaw = id => id && fileServer.get(`/raw/${id}`);

/**
 * 文件内部链接(支持批量,以逗号隔开)
 * @param {*} ids
 */
export const fileRawUrl = ids =>
  fileMeta(ids).then(data => {
    return _.reduce(
      data,
      (res, { id, urlPrivate }) => {
        res[id] = `${urlPrivate}?token=${fileServers.token}`;
        return res;
      },
      {},
    );
  });

/**
 * 内部apiServer
 */
export const apiServer = createMethods(apiUrl, {
  error: res => {
    log.error('apiServer host error', res);
  },
  options: {
    headers: {
      apikey,
    },
  },
});
