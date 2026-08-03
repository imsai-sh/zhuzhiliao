import { UIAbility } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

const DOMAIN = 0x0000;
const TAG = 'Zhuzhiliao';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    try {
      const mainWindow = windowStage.getMainWindowSync();
      mainWindow.setWindowLayoutFullScreen(true)
        .then(() => mainWindow.setWindowSystemBarProperties({
          statusBarColor: '#00000000',
          navigationBarColor: '#00000000',
          statusBarContentColor: '#F0E6D2',
          navigationBarContentColor: '#F0E6D2',
          isStatusBarLightIcon: false,
          isNavigationBarLightIcon: false
        }))
        .catch((err: Error) => {
          hilog.warn(DOMAIN, TAG, 'Failed to enable immersive layout. Cause: %{public}s', JSON.stringify(err));
        });
    } catch (err) {
      hilog.warn(DOMAIN, TAG, 'Failed to get main window. Cause: %{public}s', JSON.stringify(err));
    }

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'Failed to load content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, TAG, 'Content loaded.');
    });
  }
}
