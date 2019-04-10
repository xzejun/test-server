import { spawn, exec } from 'child_process';

export const execPromise = (cmd, options = {}, errCheck) => {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      const msg = `${error ? `------>error:\n${error}` : ''}
      ${stdout ? `------>stdout:\n${stdout}` : ''}
      ${stderr ? `------>stderr:\n${stderr}` : ''}`;
      // eslint-disable-next-line
      console.debug(msg);
      if (errCheck && msg.indexOf(errCheck) >= 0) {
        reject();
      } else {
        resolve();
      }
    });
  });
};

export const spawnPromise = (cmd, args, options, ctrls = {}) => {
  return new Promise((resolve /* , reject */) => {
    const { log = console, endMsg } = ctrls;
    const sp = spawn(cmd, args, options);
    sp.stdout.on('data', data => {
      const res = `${data}`;
      log.debug('stdout', res);
      if (endMsg && res.indexOf(endMsg) >= 0) {
        resolve(2);
      }
    });
    sp.stderr.on('data', data => {
      log.debug('stderr', data);
    });
    sp.on('exit', code => {
      resolve(code);
    });
  });
};
