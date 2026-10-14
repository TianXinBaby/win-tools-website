<script setup>
import MainLayout from './layouts/MainLayout.vue'
import SiteFooter from './components/SiteFooter.vue'
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <RouterView v-if="route.meta.adminArea" />
  <MainLayout v-else><RouterView /></MainLayout>
  <SiteFooter />
</template>
