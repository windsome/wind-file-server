export default EC => ({
  [EC.OK]: '操作正常',
  [EC.ERR_UNKNOWN]: '系统错误',
  [EC.ERR_BUSY]: '系统忙',
  [EC.ERR_PARAM_ERROR]: '参数错误',
  [EC.ERR_NO_SUCH_ENTITY]: '没有该实体',
  [EC.ERR_NOT_MULTPART]: '不是multipart/*类型数据'
});
