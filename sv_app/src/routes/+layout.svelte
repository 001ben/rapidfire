<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/rapidfire_edited.svg';
	import { isDarkMode  } from '$lib/logic/darkmode.svelte';
  import Notifications from 'svelte-notifications';
	
	let { children } = $props();
	$effect(() => {
  if (isDarkMode.dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Notifications>
	{@render children?.()}
</Notifications>
