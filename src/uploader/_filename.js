import _debug from 'debug';
const debug = _debug('app:_filename');

// const uuid = require('uuid');
const path = require('path');
const dateformat = require('dateformat');

// export const _genFileName = filename => {
//   var destfile = `${path.basename(
//     filename,
//     path.extname(filename)
//   )}.${dateformat(new Date(), 'yyyymmddHHMMss')}-${uuid.v4()}${path.extname(
//     filename
//   )}`;
//   return destfile;
// };

let lastDatetime = null;
let lastDatetimeIndex = 0;
export const fieldDatetime = () => {
  let datetime = dateformat(new Date(), 'yyyymmddHHMMss');
  if (datetime === lastDatetime) {
    lastDatetimeIndex++;
    return datetime + '.' + lastDatetimeIndex;
  } else {
    lastDatetime = datetime;
    lastDatetimeIndex = 0;
    return datetime;
  }
};

export const defFilename = filename => {
  let extname = (filname && path.extname(filename)) || '';
  let basename = (filname && path.basename(filename, extname)) || '_';
  basename = beautifyFilename(basename);
  let datetime = fieldDatetime();
  return datetime + basename.slice(-11) + extname;
};

export const beautifyFilename = filename => {
  if (!filename) return '';
  let nName = filename.replace(
    /(\/)|(\\)|(\*)|(\ )|(\')|(\")|(\:)|(\!)|(\&)|(\n)|(\r)|(\t)|(\f)|(\[)|(\])|(\{)|(\})|(\()|(\))/g,
    ''
  );
  if (!nName) nName = '_';
  // nName = nName.slice(-15);
  return nName;
};

export const _genFileName = defFilename;
