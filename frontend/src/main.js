import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag } from 'element-plus'
import 'element-plus/theme-chalk/base.css'
import 'element-plus/theme-chalk/el-alert.css'
import 'element-plus/theme-chalk/el-button.css'
import 'element-plus/theme-chalk/el-empty.css'
import 'element-plus/theme-chalk/el-skeleton.css'
import 'element-plus/theme-chalk/el-tag.css'
import './assets/main.css'

const app = createApp(App)

app.use(router)
for (const component of [ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag]) {
  app.use(component)
}

app.mount('#app')
