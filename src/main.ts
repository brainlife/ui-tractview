import { createApp } from 'vue'

import App from './App.vue'

// @ts-ignore
import SimpleWebWorker from 'simple-web-worker'

const app = createApp(App);
app.config.globalProperties.$worker = SimpleWebWorker;

app.mount('#app')
