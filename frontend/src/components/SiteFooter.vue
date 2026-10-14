<script setup>
const beianIconUrl = `${import.meta.env.BASE_URL}images/gongan-beian.png`
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-inner">
      <span class="footer-brand">Win Tools</span>
      <p>让系统资源更清晰，让日常操作更简单。</p>
      <span>Windows 下载优先使用 Microsoft 官方渠道</span>
    </div>
    <div class="container footer-legal">
      <p class="footer-copyright">© 2026 Win Tools</p>
      <div class="footer-registrations">
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=36082802000204"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="beian-icon" :src="beianIconUrl" alt="" />
          <span>赣公网安备36082802000204号</span>
        </a>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
          赣ICP备2026025057号-1
        </a>
      </div>
    </div>
  </footer>
</template>
