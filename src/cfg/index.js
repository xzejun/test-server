import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';

const isDev = process.env.NODE_ENV === 'development';
const readJson = file => (fs.existsSync(file) ? fs.readJsonSync(file) : {});

const serverConfigDir = '/data1/etc/servers/';
// 共享配置
const globalConfigFile = isDev
  ? path.join(__dirname, './server.json')
  : process.env.yxcfgServer || path.join(serverConfigDir, 'server.json');

// 项目配置
const privateConfigFile = path.join(__dirname, '../server.json');
const privateConfig = readJson(privateConfigFile);

// 环境配置
const envConfigFile = path.join(
  serverConfigDir,
  `${privateConfig.name || privateConfig.port}.env.${process.env.NODE_ENV || 'production'}.json`,
);

export default _.merge({ isDev }, readJson(globalConfigFile), privateConfig, readJson(envConfigFile));
