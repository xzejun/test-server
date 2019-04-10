import {
  projectGet,
  projectAdd,
  projectEdit,
  projectDel,
  datatypeGet,
  projectStatusGet,
  projectDataGet,
  projectDataEdit,
  projectStatusEdit,
  projectLogAdd,
  projectLogGet,
  projectStationGet,
  importData,
} from './data';

export default r => {
  // [项目]查询
  r.get('/project', ctx => {
    return projectGet(ctx.query).then(ctx.done);
  });
  // [项目]添加
  r.post('/project', ctx => {
    return projectAdd(ctx.request.body).then(ctx.done);
  });
  // [项目]编辑
  r.put('/project', ctx => {
    return projectEdit(ctx.request.body).then(ctx.done);
  });
  // [项目]删除
  r.put('/projectDel', ctx => {
    return projectDel(ctx.request.body).then(ctx.done);
  });
  // [数据类型]查询
  r.get('/datatype', ctx => {
    return datatypeGet(ctx.query).then(ctx.done);
  });
  // [查看项目]
  r.get('/projectStatus', ctx => {
    return projectStatusGet(ctx.query).then(ctx.done);
  });
  // 导入
  r.post('/importData', ctx => {
    return importData(ctx.request.body).then(ctx.done);
  });
  // [获取站内数据]
  r.get('/projectStation', ctx => {
    return projectStationGet(ctx.query).then(ctx.done);
  });
  // [获取第三方数据]
  r.get('/projectData', ctx => {
    return projectDataGet(ctx.query).then(ctx.done);
  });
  // [编辑第三方数据]
  r.put('/projectData', ctx => {
    const { userId } = ctx.state;
    return projectDataEdit({ userId, ...ctx.request.body }).then(ctx.done);
  });
  // [审核状态]
  r.put('/projectStatus', ctx => {
    return projectStatusEdit(ctx.request.body).then(ctx.done);
  });
  // [日志]添加
  r.post('/projectLog', ctx => {
    const { userId } = ctx.state;
    return projectLogAdd({ userId, ...ctx.request.body }).then(ctx.done);
  });
  // [日志]获取
  r.get('/projectLog', ctx => {
    return projectLogGet(ctx.query).then(ctx.done);
  });
};
