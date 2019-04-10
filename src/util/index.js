import uuidv4 from 'uuid/v4';
import _ from 'lodash';
import crypto from 'crypto';
import fs from 'fs';

/**
 * uuid
 */
export const uuid = () => uuidv4().replace(/-/g, '');

/**
 * 清理数据把null数据格式化
 * @param data
 * @returns {*}
 */
export function pureData(data) {
  if (_.isPlainObject(data)) {
    let newData = _.reduce(
      data,
      (r, v, k) => {
        r[k] = pureData(v);
        return r;
      },
      {},
    );
    newData = _.omitBy(newData, _.isNull);
    if (_.isEmpty(newData)) {
      return null;
    }
    return newData;
  } else if (_.isArray(data)) {
    const newData = _.map(data, i => pureData(i));
    if (_.isEmpty(newData)) {
      return null;
    }
    return newData;
  }
  return data;
}

export const checkArgEmpty = (arg, name) => {
  if (arg === undefined || arg === null || arg === '') {
    throw `${name}必填`;
  }
};

export const checkArgLength = (arg, len, name) => {
  if (arg && arg.length > len) {
    throw `${name}长度最大为${len},当前为${arg.length}`;
  }
};

export const fileMd5 = file => {
  return new Promise(resolve => {
    const stream = fs.createReadStream(file);
    const hash = crypto.createHash('md5');
    stream.on('data', hash.update.bind(hash));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};
