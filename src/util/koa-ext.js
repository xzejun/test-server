/* eslint no-console: 0 */
import logger from './log';

const isDev = process.env.NODE_ENV === 'development';

function done(ctx, body, code = 200) {
  ctx.status = code;
  if (body !== undefined && body !== null) {
    ctx.body = body;
  } else {
    ctx.status = 204;
  }
}

function fail(ctx, err) {
  let status = 500;
  let message = '';
  let msg;
  switch (typeof err) {
    case 'number':
      status = err;
      break;
    case 'string':
      message = err;
      break;
    case 'object':
      switch (typeof err.code) {
        case 'number':
          status = err.code;
          break;
        case 'string':
          if (err.code.startsWith('LIMIT_')) {
            status = 413; // for multer
          }
          break;
        default:
          if (typeof err.statusCode === 'number') {
            status = err.statusCode;
          } else if (typeof err.status === 'number') {
            // eslint-disable-next-line
            status = err.status;
          }
          break;
      }
      msg = err.message || err.text || err.toString();
      if (isDev) message = msg;
      if (err.stack || err.code) {
        logger.error(`${ctx.method} ${ctx.path} [${status}]`, err);
      }
      break;
    default:
      break;
  }
  ctx.status = status;
  ctx.body = message;
  return {
    status,
    message
  };
}

/**
 * 为ctx添加done和fail方法
 */
export function ext() {
  return async (ctx, next) => {
    ctx.done = done.bind(undefined, ctx);
    ctx.fail = fail.bind(undefined, ctx);
    await next();
  };
}

/**
 * 通用的错误处理中间件
 * @param opts 选项（log - 日志）
 */

export function error() {
  return (ctx, next) =>
    next().catch(err => {
      const {
        status,
        message
      } = fail(ctx, err);
      if (ctx.headers.apptype === 'm') {
        ctx.body = {
          status,
          message,
        };
      }
      if (isDev) console.error(err);
    });
}
