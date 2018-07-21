import ErrCode from 'errcode';
export default ErrCode;
//export default from 'errcode';

export const EC = {
    ERR_OK: 0,
    ERR_UNKNOWN: 40001,
    ERR_BUSY: 40002,
    ERR_PARAM_ERROR: 40003,
    ERR_NO_SUCH_ENTITY: 40004,
    ERR_NOT_MULTPART: 41000,
}

//export const EM= {};
export const EM = require('./Errcode.cn').default(EC);
