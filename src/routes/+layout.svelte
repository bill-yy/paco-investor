<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();
	let mobileNavOpen = $state(false);

	const nav = [
		{ href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ href: '/positions', label: 'Posiciones', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
		{ href: '/diary', label: 'Diario', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
		{ href: '/markets', label: 'Mercados', icon: 'M3 3v18h18M7 14l4-4 3 3 5-5' },
		{ href: '/macro', label: 'Macro', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10' },
		{ href: '/research', label: 'Análisis', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
		{ href: '/watchlist', label: 'Watchlist', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }
	];

	const now = new Date().toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' });

	function closeNav() {
		mobileNavOpen = false;
	}
</script>

<!-- Mobile top bar -->
<div class="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border)]">
	<a href="/" class="flex items-center gap-2" onclick={closeNav}>
		<div class="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-up)] flex items-center justify-center">
			<span class="text-white font-bold text-xs">P</span>
		</div>
		<span class="text-sm font-semibold text-[var(--color-text-primary)]">PacoInvestor</span>
	</a>
	<button
		onclick={() => (mobileNavOpen = !mobileNavOpen)}
		class="p-2 -mr-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
		aria-label="Toggle navigation"
	>
		{#if mobileNavOpen}
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
		{:else}
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
		{/if}
	</button>
</div>

<div class="flex min-h-screen">
	<!-- Mobile drawer backdrop -->
	{#if mobileNavOpen}
		<button
			class="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
			onclick={closeNav}
			aria-label="Close navigation"
		></button>
	{/if}

	<!-- Sidebar -->
	<aside
		class="fixed md:sticky md:top-0 z-40 md:z-0 w-64 md:w-56 h-screen md:h-screen shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex flex-col transition-transform duration-200 -translate-x-full md:translate-x-0 {mobileNavOpen ? 'translate-x-0' : ''}"
	>
		<div class="p-5 border-b border-[var(--color-border)]">
			<div class="flex items-center gap-2.5">
				<div class="w-8 h-8 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-up)] flex items-center justify-center">
					<span class="text-white font-bold text-sm">P</span>
				</div>
				<div>
					<div class="text-sm font-semibold text-[var(--color-text-primary)]">PacoInvestor</div>
					<div class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Value · 3-7y</div>
				</div>
			</div>
		</div>

		<nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
			{#each nav as item}
				<a
					href={item.href}
					onclick={closeNav}
					class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors {page.url.pathname === item.href
						? 'bg-[var(--color-surface-hover)] text-[var(--color-accent)] border-l-2 border-[var(--color-accent)]'
						: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'}"
				>
					<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
					</svg>
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="p-3 border-t border-[var(--color-border)]">
			<div class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Benchmark</div>
			<div class="text-xs font-mono text-[var(--color-text-secondary)]">S&P 500 · USD</div>
			<div class="mt-2 text-[10px] text-[var(--color-text-muted)]">{now} · MAD</div>
		</div>
	</aside>

	<!-- Main -->
	<main class="flex-1 min-w-0 overflow-x-hidden">
		{@render children()}
	</main>
</div>
