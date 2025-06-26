const self = {};

/**
 * 날짜 계산용 모듈
 * @param {Number} seed 계산할 날짜 (0~30)
 * @returns 
 */
self.getDate = (seed) => {
  const today   = new Date();
  const month   = new Date(new Date().setDate(today.getDate() + seed)).getMonth() + 1;
  const day     = new Date(new Date().setDate(today.getDate() + seed)).getDate();
  const dateObj = {};

  dateObj.year = today.getFullYear().toString();

  if(month <= 9) dateObj.month = "0" +  month.toString();
  else dateObj.month = month.toString();

  if(day <= 9) dateObj.day = "0" + day.toString();
  else dateObj.day = day.toString();

  dateObj.time = " " + today.getHours().toString() + ":" + today.getMinutes().toString() + ":" + today.getSeconds().toString();

  const ret = dateObj.year + dateObj.month + dateObj.day + dateObj.time;
  return ret;
}


module.exports = self;