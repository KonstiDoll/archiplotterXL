import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { version } from '../package.json'
import './style.css'
import App from './App.vue'

document.title = `ArchiSlicer ${version}`;

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

app.mount('#app');
