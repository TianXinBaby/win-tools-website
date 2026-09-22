<script setup>
import MainLayout from './layouts/MainLayout.vue'
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <RouterView v-if="route.meta.adminArea" />
  <MainLayout v-else><RouterView /></MainLayout>
</template>
