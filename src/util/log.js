import _ from 'lodash';
import cfg from 'cfg';
import log4js from 'log4js';

const cwd = _.split(process.cwd(), '/');

let { log: logCfg } = cfg;
logCfg = _.merge(logCfg || {}, {
  appenders: {
    logstash: {
      application: cfg.name || cwd[cwd.length - 2] || cfg.port,
      logChannel: cwd[cwd.length - 1],
    },
  },
});

log4js.configure(logCfg);
const logger = log4js.getLogger();

const { PATH, LS_COLORS, ...env } = process.env;
if (process.env.NODE_ENV !== 'development') {
  logger.info('process.env', env);
}
export default logger;
