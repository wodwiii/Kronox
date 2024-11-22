<script>
	import { goto } from '$app/navigation';
	import { ArrowRight, Bot, Building2, Package, Shield } from 'lucide-svelte';
</script>

<div class="min-h-screen bg-black bg-gradient-to-br from-black via-gray-900 to-green-900">
	<div class="absolute inset-0 overflow-hidden">
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.1)_0%,transparent_50%)] opacity-30"
		></div>
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,255,0,0.05)_0%,transparent_30%)]"
		></div>
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(0,255,0,0.05)_0%,transparent_30%)]"
		></div>
	</div>

	<div class="relative">
		<header class="px-6 py-4">
			<nav class="mx-auto flex max-w-7xl items-center justify-between">
				<div class="flex items-center gap-2">
					<img src="/logo-128.png" alt="Kronox Logo" class="h-8 w-8" />
					<div class="text-2xl font-bold text-white">Kronox</div>
				</div>
				<div class="flex items-center gap-6">
					<button
						class="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
            on:click={()=> goto('/dashboard')}
					>
						Dashboard
					</button>
				</div>
			</nav>
		</header>

		<main class="px-6 py-16">
			<div class="mx-auto max-w-5xl">
				<div class="flex flex-col items-center text-center">
					<h1 class="mb-6 text-5xl md:text-7xl font-bold leading-tight text-white">
						Deploy Smart Agents for
						<span class="text-green-500"> Smarter Operations</span>
					</h1>
					<p class="mb-8 max-w-2xl text-lg text-gray-300">
						Empower your business with AI agents that handle procurement, customer service, and warehouse operations autonomously. Our smart agents work 24/7 to optimize your supply chain and delight your customers.
					</p>

					<button
						class="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
            on:click={()=> goto('/dashboard')}
					>
						Get Started <ArrowRight class="h-4 w-4" />
					</button>
				</div>
			</div>
		</main>

		<section class="px-6 py-16">
			<div class="mx-auto max-w-7xl">
				<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-xl border border-green-500/20 bg-white/5 p-6 backdrop-blur-lg">
						<Bot class="mb-4 h-8 w-8 text-green-500" />
						<h3 class="mb-2 text-xl font-semibold text-white">AI Agents</h3>
						<p class="text-gray-300">
							Intelligent agents that automate inventory management tasks and provide predictive
							insights.
						</p>
					</div>

					<div class="rounded-xl border border-green-500/20 bg-white/5 p-6 backdrop-blur-lg">
						<Building2 class="mb-4 h-8 w-8 text-green-500" />
						<h3 class="mb-2 text-xl font-semibold text-white">Multi-Warehouse</h3>
						<p class="text-gray-300">
							Seamlessly manage multiple warehouses with real-time synchronization and optimization.
						</p>
					</div>

					<div class="rounded-xl border border-green-500/20 bg-white/5 p-6 backdrop-blur-lg">
						<Package class="mb-4 h-8 w-8 text-green-500" />
						<h3 class="mb-2 text-xl font-semibold text-white">Smart Analytics</h3>
						<p class="text-gray-300">
							Deep insights into inventory trends, stock levels, and supply chain optimization.
						</p>
					</div>
				</div>
			</div>
		</section>

		<section class="px-6 py-16">
			<div class="mx-auto max-w-7xl">
				<div
					class="rounded-2xl border border-green-500/20 bg-white/5 p-12 text-center backdrop-blur-lg"
				>
					<h2 class="mb-4 text-3xl font-bold text-white">
						Ready to Transform Your Inventory Management?
					</h2>
					<p class="mb-8 text-gray-300">
						Join thousands of businesses that trust Kronos for their inventory needs.
					</p>
					<button
						class="rounded-lg bg-green-600 px-8 py-3 font-medium text-white hover:bg-green-700"
					>
						Start Now
					</button>
				</div>
			</div>
		</section>

		<footer class="border-t border-green-500/20 px-6 py-8">
			<div class="mx-auto max-w-7xl">
				<div
					class="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left"
				>
					<div class="text-sm text-gray-400">© 2024 Kronos. All rights reserved.</div>
					<div class="flex gap-6">
						<a href="#privacy" class="text-sm text-gray-400 hover:text-white">Privacy</a>
						<a href="#terms" class="text-sm text-gray-400 hover:text-white">Terms</a>
						<a href="#contact" class="text-sm text-gray-400 hover:text-white">Contact</a>
					</div>
				</div>
			</div>
		</footer>
	</div>
</div>
