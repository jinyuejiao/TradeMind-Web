/**
 * App 启动引导：状态栏、启动屏、返回键、推送监听。
 * 依赖：tm-capacitor.js → tm-native-bridge.js → 本文件
 */
(function (global) {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  async function boot() {
    var Native = global.TM_Native;
    if (!Native || !Native.isNative || !Native.isNative()) {
      return;
    }

    var TC = global.TMCapacitor || {};
    document.documentElement.classList.add('tm-native-app');
    document.body && document.body.classList.add('tm-native-app');

    try {
      if (TC.StatusBar && TC.StatusBar.setStyle) {
        await TC.StatusBar.setStyle({ style: (TC.Style && TC.Style.Dark) || 'DARK' });
        if (TC.StatusBar.setBackgroundColor) {
          await TC.StatusBar.setBackgroundColor({ color: '#0F172A' });
        }
      }
    } catch (e) {
      console.warn('[tm-app-boot] StatusBar', e);
    }

    try {
      if (TC.SplashScreen && TC.SplashScreen.hide) {
        await TC.SplashScreen.hide();
      }
    } catch (e) {
      console.warn('[tm-app-boot] SplashScreen', e);
    }

    // Android 返回键：优先关闭弹层，否则退出确认
    try {
      if (TC.App && TC.App.addListener) {
        TC.App.addListener('backButton', function (ev) {
          var closed = false;
          try {
            var dialogs = document.querySelectorAll('.tm-dialog-root:not(.hidden), #tm-save-image-preview');
            if (dialogs && dialogs.length) {
              var last = dialogs[dialogs.length - 1];
              if (last.id === 'tm-save-image-preview') {
                last.remove();
                closed = true;
              } else {
                last.classList.add('hidden');
                closed = true;
              }
            }
          } catch (e2) { /* ignore */ }

          if (!closed && ev && ev.canGoBack) {
            global.history.back();
            return;
          }
          if (!closed && Native.app && Native.app.exit) {
            if (global.confirm('确定退出 TradeMind？')) {
              Native.app.exit();
            }
          }
        });
      }
    } catch (e) {
      console.warn('[tm-app-boot] backButton', e);
    }

    // 推送：注册并转发事件（业务可监听 tm:push）
    try {
      if (Native.push && Native.push.register) {
        Native.push.register().then(function (r) {
          console.info('[tm-app-boot] push register', r);
        }).catch(function (err) {
          console.warn('[tm-app-boot] push register failed', err);
        });
        Native.push.onNotification(function (evt) {
          try {
            global.dispatchEvent(new CustomEvent('tm:push', { detail: evt }));
          } catch (e3) { /* ignore */ }
        });
      }
    } catch (e) {
      console.warn('[tm-app-boot] push', e);
    }

    console.info('[tm-app-boot] ready, platform=', Native.getPlatform());
  }

  ready(function () {
    // 插件 bundle 可能稍后就绪
    setTimeout(boot, 0);
  });
})(typeof window !== 'undefined' ? window : this);
