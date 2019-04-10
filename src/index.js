import Koa from 'koa';
import { isFunction, isObjectLike, each, noop, padEnd, startsWith } from 'lodash';
import Router from 'koa-router';
import dirs from 'require-dir';
import jwt from 'jsonwebtoken';
import koaBody from 'koa-body';
import { ext, error } from 'util/koa-ext';
import logger from 'util/log';
import cfg from 'cfg';

const app = new Koa();
app.use(error(logger));
app.use(ext());
if (process.env.NODE_ENV === 'development') {
  app.use(require('koa-logger')());
}

// 内容解析
app.use(
  koaBody({
    limit: null,
    json: true,
    text: true,
    multipart: false,
    urlencoded: false, // 不解析url  使其能够下载。
    ...cfg.koaBody,
  }),
);
const bearerRegex = /^Bearer$/i;
// 用户登录信息
app.use(async (ctx, next) => {
  const { authorization } = ctx.headers;
  if (authorization) {
    const parts = authorization.split(' ');
    if (parts.length === 2) {
      const scheme = parts[0];
      const credentials = parts[1];
      if (bearerRegex.test(scheme)) {
        const state = jwt.decode(credentials);
        if (state) {
          const { id: userId } = state;
          ctx.state = { userId };
        }
      }
    }
  }
  ctx.state = { ...ctx.state };
  return next();
});
const printDebug = stack => {
  each(stack, ({ methods, path }) => {
    logger.debug(`http api: ${padEnd(methods[methods.length - 1], 8)}${path || '[index]'}`);
  });
};

function loadRoutes(routes, uri, print) {
  for (const name in routes) {
    if (name === 'data' || name === 'core') {
      continue;
    }
    const route = routes[name];
    if (isObjectLike(route)) {
      loadRoutes(route, `${uri}${name === 'index' ? '' : `/${name}`}`, print);
    } else if (isFunction(route)) {
      const prefix = `${uri}${name === 'default' ? '' : `/${name}`}`;
      const r = new Router({
        prefix,
      });
      route(r, app);
      app.use(r.routes());
      print(r.stack);
    }
  }
}
cfg.api = cfg.api || '';
if (cfg.api && !startsWith(cfg.api, '/')) {
  cfg.api = `/${cfg.api}`;
}

loadRoutes(dirs('./api', { recurse: true }), cfg.api, process.env.NODE_ENV === 'development' ? printDebug : noop);

app.listen(cfg.port);
logger.info(`serives.main: http://127.0.0.1:${cfg.port}`);
