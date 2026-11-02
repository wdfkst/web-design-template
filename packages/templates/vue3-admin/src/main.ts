import { createApp, nextTick } from 'vue'
import 'ant-design-vue/dist/reset.css'
import './theme/base.css'
import App from './App.vue'
import { router } from './router'
import { reportPreviewReady } from './preview-ready'

createApp(App).use(router).mount('#app')
void reportPreviewReady(router.isReady().then(() => nextTick()))
