<template>
  <div class="p-5 d-flex flex-column">
    <h2 class="fw-bold font">Posts</h2>
    <div class="d-flex flex-column align-items-center">
      <PostsList :uid="''"></PostsList>
    </div>
  </div>
</template>

<script>
import PostsList from '@/components/PostsList.vue'
export default {
  name: 'AppDashboardView',
  components: { PostsList }
}
</script>
