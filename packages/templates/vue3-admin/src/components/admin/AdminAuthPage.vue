<script setup lang="ts">
import { ref } from 'vue'
import { Button, Input } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from '../../navigation'
import { getDemoSession } from '../../auth/demo-session'
import { resolveDemoTarget } from '../../auth/demo-router'
import AdminIcon from './AdminIcon.vue'
import AdminAuthArtwork from './AdminAuthArtwork.vue'
import '../../theme/auth.css'
interface Asset { src: string; alt: string; w: number; h: number }
defineProps<{ title: string; panel: { heading?: string; subheading?: string; fields?: { label: string; type: string; placeholder?: string }[]; submitLabel?: string; assets?: Record<string, Asset> } }>()
const router = useRouter()
const route = useRoute()
const account = ref('')
const password = ref('')
const passwordVisible = ref(false)
const passwordFocused = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
function fillDemo() {
  account.value = 'demo'
  password.value = 'demo123'
  error.value = ''
  notice.value = '已填入演示账号，请点击登录按钮继续。'
}
async function submit() {
  if (submitting.value) return
  error.value = ''
  notice.value = ''
  if (!getDemoSession().signIn(account.value, password.value)) {
    error.value = '请使用演示账号 demo 和密码 demo123，请勿输入真实凭证。'
    return
  }
  password.value = ''
  submitting.value = true
  try {
    const target = auth ? resolveDemoTarget(router, auth, route.query.returnTo) : null
    if (!target) {
      notice.value = '演示登录成功，当前项目没有可进入的后台。'
      return
    }
    const failure = await router.replace(target)
    if (failure) error.value = '暂时无法进入后台，请重试。'
  } catch {
    error.value = '暂时无法进入后台，请重试。'
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <main class="auth-page">
    <header class="auth-header"><span class="auth-brand"><AdminIcon name="grid" />{{ title }}</span><span class="auth-badge">演示工作空间</span></header>
    <div class="auth-shell">
      <section class="auth-visual" aria-label="工作空间介绍">
        <div class="auth-intro"><h2>把复杂留给系统。<br />把专注留给你。</h2><p>连接团队、组织与每一项工作。<br />从这里，开启井然有序的一天。</p></div>
        <AdminAuthArtwork :asset="panel.assets?.illustration" :password-focused="passwordFocused" />
        <div class="auth-art-footer"><span class="auth-mini-icons" aria-hidden="true"><AdminIcon name="grid" /><AdminIcon name="users" /><AdminIcon name="layers" /></span><span>一个入口，连接你的工作</span></div>
      </section>
      <section class="auth-form-side" aria-labelledby="auth-heading">
        <div class="auth-welcome" aria-hidden="true"><AdminIcon name="arrow-right" /></div>
        <h1 id="auth-heading">{{ panel.heading || title }}</h1>
        <p class="auth-subtitle">{{ panel.subheading || '进入演示工作空间，继续今天的工作。' }}</p>
        <p class="auth-disclaimer">演示登录，不连接认证服务，请勿输入真实凭证。</p>
        <form class="auth-form" @submit.prevent="submit">
          <label class="auth-field" for="auth-account"><span>演示账号</span><Input id="auth-account" v-model:value="account" type="text" autocomplete="off" placeholder="请输入 demo" :disabled="submitting" :aria-invalid="Boolean(error)" aria-describedby="auth-feedback"><template #prefix><AdminIcon name="user" /></template></Input></label>
          <label class="auth-field" for="auth-password"><span>演示密码</span><Input id="auth-password" v-model:value="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="off" placeholder="请输入 demo123" :disabled="submitting" :aria-invalid="Boolean(error)" aria-describedby="auth-feedback" @focus="passwordFocused = true" @blur="passwordFocused = false"><template #prefix><AdminIcon name="lock" /></template><template #suffix><Button class="auth-eye-button" type="text" html-type="button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible"><AdminIcon :name="passwordVisible ? 'eye-invisible' : 'eye'" /></Button></template></Input></label>
          <Button class="auth-submit" html-type="submit" :loading="submitting" :disabled="submitting" block><span>{{ submitting ? '正在进入工作空间' : panel.submitLabel || '登录工作台' }}</span><AdminIcon name="arrow-right" /></Button>
        </form>
        <div class="auth-demo"><p>公开账号 <strong>demo</strong> / 密码 <strong>demo123</strong></p><Button data-action="fill-demo" html-type="button" :disabled="submitting" block @click="fillDemo">填充演示账号</Button></div>
        <div id="auth-feedback" class="auth-feedback"><p v-if="error" role="alert">{{ error }}</p><p v-else role="status" aria-live="polite">{{ notice }}</p></div>
        <p class="auth-footnote">输入内容不会上传或保存。<br />演示会话仅用于体验，不是真实身份认证。</p>
      </section>
    </div>
  </main>
</template>
