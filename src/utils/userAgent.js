export const parseUserAgent = ua => {
  // Wechat UserAgent: "Mozilla/5.0(iphone;CPU iphone OS 5_1_1 like Mac OS X) AppleWebKit/534.46(KHTML,like Geocko) Mobile/9B206 MicroMessenger/5.0"
  var Sys = {};
  if (ua) {
    ua = ua.toLowerCase();
    var s;
    (s = ua.match(/micromessenger\/([\d.]+)/))
      ? (Sys.wechat = s[1])
      : (s = ua.match(/msie ([\d.]+)/))
        ? (Sys.ie = s[1])
        : (s = ua.match(/firefox\/([\d.]+)/))
          ? (Sys.firefox = s[1])
          : (s = ua.match(/chrome\/([\d.]+)/))
            ? (Sys.chrome = s[1])
            : (s = ua.match(/opera.([\d.]+)/))
              ? (Sys.opera = s[1])
              : (s = ua.match(/version\/([\d.]+).*safari/))
                ? (Sys.safari = s[1])
                : 0;

    // TODO: check mobile.
    // var mobile;
    // (mobile = ua.match(/mobile\/([*.]+)/))
    //   ? (Sys.mobile = s[1])
    //   : 0;
  }
  return Sys;
};

export default parseUserAgent;
