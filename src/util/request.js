import uri from 'url';
import fetch from 'node-fetch';
import { extend, merge, isObjectLike, isArrayLike, isFunction } from 'lodash';

const CONTENT_TYPE = 'Content-Type';
const JSON_TYPE = 'application/json';

/**
 * 默认http选项
 * @type {{headers: {}}}
 */
const DefaultOptions = {
  headers: {
    [CONTENT_TYPE]: JSON_TYPE,
  },
};
/**
 * 获取响应结果的媒体类型（Content-Type）
 * @param res 响应结果
 * @return Content-Type字符串
 */
export function getType(res) {
  return res.headers.get(CONTENT_TYPE);
}

/**
 * 判断结果是否为JSON格式
 * @param res 响应结果
 * @param type 原始Content-Type字符串
 */
export function isJson(res, type) {
  type = type || getType(res);
  if (type && type.indexOf('json') > -1) {
    res.isJson = true;
    return true;
  }
  return false;
}

/**
 * 判断结果是否为文本格式
 * @param res 响应结果
 * @param type 原始Content-Type字符串
 */
export function isText(res, type) {
  type = type || getType(res);
  if (type && (type.indexOf('text') > -1 || type.indexOf('plain') > -1)) {
    res.isText = true;
    return true;
  }
  return false;
}

/**
 * 解析AJAX响应结果
 * @param res 响应结果
 * @returns {JSON|string} 根据媒体类型返回JSON对象或文本内容
 */
export function parseResponse(res) {
  let body;
  if (isJson(res)) {
    body = res.json();
  } else if (isText(res)) {
    body = res.text();
  } else {
    body = res.buffer();
  }
  return body.then(data => ({ res, data }));
}

/**
 * 解析AJAX响应结果
 * @param res 响应结果
 * @returns {{status, message}} 错误对象
 */
/* eslint no-plusplus: 0 */
function parseError(res) {
  const error = {};
  if (typeof res === 'object') {
    let stage = 0;
    for (const key in res) {
      const value = res[key];
      switch (key) {
        case 'code':
        case 'status':
          if (typeof value === 'number') {
            error.status = value;
            ++stage;
          }
          break;
        case 'text':
        case 'message':
        case 'statusText':
          if (typeof value === 'string') {
            error.message = value;
            ++stage;
          }
          break;
      }
      if (stage === 2) break;
    }
  } else if (typeof res === 'string') {
    error.message = res;
  }
  return error;
}

/**
 * 检测AJAX返回状态码
 * @param result 响应解析结果
 * @returns {res} 如不在[200,300]之间则抛出错误对象（{status,message}）
 */
export function checkStatus(result) {
  const { res, data } = result;
  if (res.ok) {
    return result;
  }
  let err = {};
  if (res.isJson) {
    err = parseError(data);
  } else if (isText(res)) {
    err.message = data;
  }
  if (!err.status) {
    err.status = res.status;
  }
  if (!err.message) {
    err.message = res.statusText;
  }
  return { err };
}

/**
 * Requests a URL, returning a promise.
 *
 * @param  {string} url       The URL we want to request
 * @param  {object} [options] The options we want to pass to "fetch"
 * @return {object}           An object containing either "data" or "err"
 */
export default function request(url, options) {
  // 添加默认选项
  options = merge({}, DefaultOptions, options || {});

  let uriObj;
  if (options.body) {
    switch (options.method) {
      case 'get':
      case 'delete': // delete中body会被忽略
        uriObj = uri.parse(url);
        uriObj.query = extend(uriObj.query, options.body);
        url = uri.format(uriObj);
        delete options.body;
        break;
      default:
        break;
    }

    // 请求json文件格式则自动转换body
    if (
      options.body &&
      (isObjectLike(options.body) || isArrayLike(options.body)) &&
      options.headers &&
      options.headers[CONTENT_TYPE] === 'application/json'
    ) {
      options.body = JSON.stringify(options.body);
    }
  }
  return fetch(url, options)
    .then(parseResponse)
    .then(checkStatus)
    .catch(err => ({ err }));
}

export const createMethod = (method, api = '', args = {}) => (url, data, opts) => {
  let error;
  let options;
  if (isFunction(args)) {
    error = args;
    options = {};
  } else {
    ({ error, options = {} } = args);
  }
  opts = merge({}, options, opts);
  const fullUrl = isFunction(api) ? api(url) : `${api}${url}`;
  const p = request(fullUrl, { method, body: data, ...opts });
  if (error) {
    p.then(res => {
      if (res.err) {
        error({ fullUrl, data, options: opts, err: res.err });
      }
      return res;
    });
  }
  return p;
};

export const createMethods = (...args) => {
  return {
    get: createMethod('get', ...args),
    post: createMethod('post', ...args),
    del: createMethod('delete', ...args),
    put: createMethod('put', ...args),
  };
};

export const get = createMethod('get');

export const post = createMethod('post');

export const del = createMethod('delete');

export const put = createMethod('put');
