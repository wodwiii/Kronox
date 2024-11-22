<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Input from '$lib/components/ui/input';
	import {
		AlertCircle,
		Bot,
		Building2,
		Mail,
		Phone,
		Settings,
		Truck,
		Upload
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import * as XLSX from 'xlsx';

	let dragOver = false;
	let fileInput: HTMLInputElement;
	let inventoryData: Array<any> = [];
	let warehouses: Set<string> = new Set();
	let selectedWarehouse = '';
	let warehouseContacts: { [key: string]: { phone?: string; email?: string } } = {};
	let suppliers: Array<{ name: string; skus: string[]; phone?: string; email?: string }> = [];
	let showAddSupplier = false;
	let showAddAgent = false;
	let newSupplier = { name: '', skus: [], phone: '', email: '' };
	let newAgent = { name: '', type: '', description: '' };

	let activeAgents = [
		{ name: 'Procurement Agent', status: 'Active', lastAction: 'Check inventory and call suppliers for restocking' },
		{
			name: 'Warehouse Agent',
			status: 'Active', 
			lastAction: 'Send Alert to Warehouse for Incoming Orders'
		},
		{ name: 'Customer Service Agent', status: 'Active', lastAction: 'Answer customer queries about orders and products' }
	];

	onMount(() => {
		// Load data from localStorage
		const storedInventoryData = localStorage.getItem('inventoryData');
		if (storedInventoryData) {
			inventoryData = JSON.parse(storedInventoryData);
			warehouses = new Set(inventoryData.map((item) => item.Warehouse));
		}

		const storedWarehouseContacts = localStorage.getItem('warehouseContacts');
		if (storedWarehouseContacts) {
			warehouseContacts = JSON.parse(storedWarehouseContacts);
		}

		const storedSuppliers = localStorage.getItem('suppliers');
		if (storedSuppliers) {
			suppliers = JSON.parse(storedSuppliers);
		}

		const storedAgents = localStorage.getItem('activeAgents');
		if (storedAgents) {
			activeAgents = JSON.parse(storedAgents);
		}
	});

	function handleFileDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const files = event.dataTransfer?.files;
		if (files?.length) {
			handleFiles(files);
		}
	}

	function handleFiles(files: FileList) {
		const file = files[0];
		const reader = new FileReader();
		reader.onload = (e: ProgressEvent<FileReader>) => {
			const data = e.target?.result as ArrayBuffer;
			if (data) {
				processXLSXData(data);
			}
		};
		reader.readAsArrayBuffer(file);
	}

	function processXLSXData(data: ArrayBuffer) {
		const workbook = XLSX.read(data, { type: 'array' });
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];

		const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

		inventoryData = jsonData.map((row) => ({
			Brand: String(row['Brand'] || ''),
			SKU: String(row['SKU'] || ''),
			Warehouse: String(row['Warehouse'] || ''),
			WarehouseStock: Number(row['WarehouseStock'] || 0),
			BufferStock: Number(row['BufferStock'] || 0),
			ReservedStock: Number(row['ReservedStock'] || 0),
			LockedStock: Number(row['LockedStock'] || 0),
			SellableStock: Number(row['SellableStock'] || 0),
			UnderStockTake: Boolean(row['UnderStockTake']),
			ProductName: String(row['ProductName'] || ''),
			UBCD99C: String(row['UBCD99C'] || ''),
			Active: Boolean(row['Active']),
			DimUnit: String(row['DimUnit'] || ''),
			Height: Number(row['Height'] || 0),
			Width: Number(row['Width'] || 0),
			Length: Number(row['Length'] || 0),
			WeightUnit: String(row['WeightUnit'] || ''),
			Weight: Number(row['Weight'] || 0),
			CostPrice: Number(row['CostPrice'] || 0),
			Currency: String(row['Currency'] || ''),
			CBM: Number(row['CBM'] || 0),
			ExpiryManaged: Boolean(row['ExpiryManaged'])
		}));

		// Extract unique warehouses
		warehouses = new Set(inventoryData.map((item) => item.Warehouse));

		// Save to localStorage
		localStorage.setItem('inventoryData', JSON.stringify(inventoryData));
	}

	function addSupplier() {
		if (newSupplier.name) {
			suppliers = [...suppliers, { ...newSupplier }];
			localStorage.setItem('suppliers', JSON.stringify(suppliers));
			newSupplier = { name: '', skus: [], phone: '', email: '' };
			showAddSupplier = false;
		}
	}

	function addAgent() {
		if (newAgent.name) {
			activeAgents = [
				...activeAgents,
				{
					name: newAgent.name,
					status: 'Active',
					lastAction: 'Agent deployed',
					type: newAgent.type,
					description: newAgent.description
				}
			];
			localStorage.setItem('activeAgents', JSON.stringify(activeAgents));
			newAgent = { name: '', type: '', description: '' };
			showAddAgent = false;
		}
	}

	function updateWarehouseContact() {
		if (!warehouseContacts[selectedWarehouse]) {
			warehouseContacts[selectedWarehouse] = {};
		}
		localStorage.setItem('warehouseContacts', JSON.stringify(warehouseContacts));
	}

	$: totalStock = inventoryData.reduce((sum, item) => sum + item.WarehouseStock, 0);
	$: lowStockItems = inventoryData.filter((item) => item.WarehouseStock < item.BufferStock).length;
</script>

<div class="min-h-screen bg-black bg-gradient-to-br from-black via-gray-900 to-green-900">
	<!-- Mesh Background -->
	<div class="absolute inset-0 overflow-hidden">
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.1)_0%,transparent_50%)] opacity-30"
		></div>
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,255,0,0.05)_0%,transparent_30%)]"
		></div>
	</div>

	<!-- Main Content -->
	<div class="relative min-h-screen p-8">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-3xl font-bold text-white">Kronos Inventory Center</h1>
			<Button
				variant="ghost"
				size="icon"
				class="text-green-500 hover:bg-green-500/20 hover:text-green-400"
			>
				<Settings class="h-6 w-6" />
			</Button>
		</div>

		<!-- Stats Grid -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<Card.Root
				class="border-green-500/20 bg-white/5 backdrop-blur-lg transition-all hover:border-green-500/40"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-sm font-medium text-gray-200">Active Agents</Card.Title>
					<Bot class="h-4 w-4 text-green-500" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold text-white">{activeAgents.length}</div>
					<p class="text-xs text-gray-400">All agents operational</p>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="border-green-500/20 bg-white/5 backdrop-blur-lg transition-all hover:border-green-500/40"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-sm font-medium text-gray-200">Warehouses</Card.Title>
					<Building2 class="h-4 w-4 text-green-500" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold text-white">{warehouses.size}</div>
					<p class="text-xs text-gray-400">Active locations</p>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="border-green-500/20 bg-white/5 backdrop-blur-lg transition-all hover:border-green-500/40"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-sm font-medium text-gray-200">Suppliers</Card.Title>
					<Truck class="h-4 w-4 text-green-500" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold text-white">{suppliers.length}</div>
					<p class="text-xs text-gray-400">Click to manage</p>
				</Card.Content>
			</Card.Root>

			<Card.Root
				class="border-green-500/20 bg-white/5 backdrop-blur-lg transition-all hover:border-green-500/40"
			>
				<Card.Header class="flex flex-row items-center justify-between pb-2">
					<Card.Title class="text-sm font-medium text-gray-200">Low Stock Items</Card.Title>
					<AlertCircle class="h-4 w-4 text-green-500" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold text-white">{lowStockItems}</div>
					<p class="text-xs text-gray-400">Needs attention</p>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Main Grid -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- AI Agent Options -->
			<Card.Root class="border-green-500/20 bg-white/5 backdrop-blur-lg">
				<Card.Header>
					<Card.Title class="text-white">AI Agent Options</Card.Title>
					<Card.Description class="text-gray-400">
						Active agents and deployment options
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#each activeAgents as agent , index}
						<div class="rounded-lg bg-green-500/10 p-4">
							<div class="flex flex-col md:flex-row space-y-2 items-center  justify-between">
								<div>
									<h3 class="font-medium text-white">{agent.name}</h3>
									<p class="text-sm text-gray-400">{agent.lastAction}</p>
								</div>
								<div class="flex flex-col md:flex-row gap-2 items-center">
									<span class="h-[30px] rounded bg-green-200/20 px-2 py-1 text-xs text-green-400">
										{agent.status}
									</span>
									<Button
										variant="ghost"
										class="max-h-[30px] w-[80px] rounded bg-green-500/20 text-xs text-white outline outline-1 outline-green-400 hover:bg-green-500/40 hover:text-white"
										on:click={() => (window.location.href = `/demo-${index}`)}
									>
										Try Demo
									</Button>
								</div>
							</div>
						</div>
					{/each}
					<div class="flex">
						<Button
							class="w-full bg-green-600 hover:bg-green-700"
							on:click={() => (showAddAgent = true)}
						>
							<Bot class="mr-2 h-4 w-4" />
							Deploy New Agent
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
			{#if showAddAgent}
				<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div class="w-[400px] space-y-4 rounded-lg bg-gray-900 p-6">
						<h3 class="text-xl font-bold text-white">Deploy New Agent</h3>
						<p class="text-sm text-gray-400">
							AI agents help automate inventory management tasks. Currently in demo mode - please
							use existing agents.
						</p>
						<Input.Input
							placeholder="Agent Name"
							bind:value={newAgent.name}
							class="bg-black/20 text-white"
						/>
						<select
							bind:value={newAgent.type}
							class="w-full rounded-lg border border-green-500/20 bg-black/20 p-2 text-white"
						>
							<option value="">Select Agent Type</option>
							<option value="inventory"
								>Inventory Management - Stock level monitoring and alerts</option
							>
							<option value="ordering">Order Processing - Automated restock suggestions</option>
							<option value="customer">Customer Service - Order status updates</option>
						</select>
						<textarea
							bind:value={newAgent.description}
							placeholder="Agent Description and Configuration"
							class="h-24 w-full rounded-lg border border-green-500/20 bg-black/20 p-2 text-white"
							disabled
						/>
						<p class="text-xs text-yellow-400">
							* Agent deployment is disabled in demo mode. Please use the existing agents to explore
							the functionality.
						</p>
						<div class="flex gap-2">
							<Button
								class="flex-1 cursor-not-allowed bg-green-600/50 hover:bg-green-600/50"
								disabled
								title="Deployment disabled in demo mode"
							>
								Deploy
							</Button>
							<Button
								class="flex-1 bg-red-600 hover:bg-red-700"
								on:click={() => (showAddAgent = false)}
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			{/if}
      			<!-- Inventory Upload -->
			<Card.Root class="border-green-500/20 bg-white/5 backdrop-blur-lg">
				<Card.Header>
					<Card.Title class="text-white">Inventory Data Upload</Card.Title>
					<Card.Description class="text-gray-400">
						Drop your XLSX inventory file or click to upload
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div
						class="cursor-pointer rounded-lg border-2 border-dashed border-green-500/20 p-8 text-center transition-all"
						class:border-green-500={dragOver}
						on:dragover|preventDefault={() => (dragOver = true)}
						on:dragleave|preventDefault={() => (dragOver = false)}
						on:drop|preventDefault={handleFileDrop}
						on:click={() => fileInput.click()}
					>
						<Upload class="mx-auto mb-4 h-12 w-12 text-green-500" />
						<p class="mb-2 text-white">Drag and drop your inventory file here</p>
						<p class="text-sm text-gray-400">Supports XLSX format</p>
						<input
							bind:this={fileInput}
							type="file"
							accept=".xlsx"
							class="hidden"
							on:change={(e) => e.target?.files && handleFiles(e.target.files)}
						/>
					</div>
					{#if inventoryData.length > 0}
						<div class="mt-4 rounded-lg bg-green-500/10 p-4">
							<h3 class="font-medium text-white">Upload Summary</h3>
							<p class="text-sm text-gray-400">Total Items: {inventoryData.length}</p>
							<p class="text-sm text-gray-400">Total Stock: {totalStock}</p>
							<p class="text-sm text-gray-400">Warehouses: {warehouses.size}</p>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
			<!-- Warehouse Management -->
			<Card.Root class="border-green-500/20 bg-white/5 backdrop-blur-lg">
				<Card.Header>
					<Card.Title class="text-white">Warehouse Management</Card.Title>
					<Card.Description class="text-gray-400">
						Select warehouse to manage contacts
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<select
						bind:value={selectedWarehouse}
						class="w-full rounded-lg border border-green-500/20 bg-black/20 p-2 text-white"
					>
						<option value="">Select Warehouse</option>
						{#each Array.from(warehouses) as warehouse}
							<option value={warehouse}>{warehouse}</option>
						{/each}
					</select>

					{#if selectedWarehouse}
						<div class="space-y-2">
							<Input.Input
								type="tel"
								placeholder="Phone number"
								value={warehouseContacts[selectedWarehouse]?.phone ?? ''}
								on:input={(e) => {
									if (selectedWarehouse) {
										warehouseContacts[selectedWarehouse].phone = e.currentTarget.value;
										updateWarehouseContact();
									}
								}}
								class="bg-black/20 text-white"
							/>
							<Input.Input
								type="email"
								placeholder="Email address"
								value={warehouseContacts[selectedWarehouse]?.email ?? ''}
								on:input={(e) => {
									if (selectedWarehouse) {
										warehouseContacts[selectedWarehouse].email = e.currentTarget.value;
										updateWarehouseContact();
									}
								}}
								class="bg-black/20 text-white"
							/>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Supplier Management -->
			<Card.Root class="border-green-500/20 bg-white/5 backdrop-blur-lg">
				<Card.Header>
					<Card.Title class="text-white">Supplier Management</Card.Title>
					<Card.Description class="text-gray-400">Manage suppliers and their SKUs</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#each suppliers as supplier}
						<div class="space-y-2 rounded-lg bg-green-500/10 p-4">
							<h3 class="font-medium text-white">{supplier.name}</h3>
							<p class="text-sm text-gray-400">SKUs: {supplier.skus.length}</p>
							<div class="text-xs text-gray-500">
								{#if supplier.phone}<Phone class="mr-1 inline h-3 w-3" />{supplier.phone}{/if}
								{#if supplier.email}<Mail class="ml-2 mr-1 inline h-3 w-3" />{supplier.email}{/if}
							</div>
						</div>
					{/each}

					<Button
						class="w-full bg-green-600 hover:bg-green-700"
						on:click={() => (showAddSupplier = true)}
					>
						Add New Supplier
					</Button>
				</Card.Content>
			</Card.Root>

			{#if showAddSupplier}
				<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div class="w-[400px] space-y-4 rounded-lg bg-gray-900 p-6">
						<Input.Input
							placeholder="Supplier name"
							bind:value={newSupplier.name}
							class="bg-black/20 text-white"
						/>
						<Input.Input
							type="tel"
							placeholder="Phone number"
							bind:value={newSupplier.phone}
							class="bg-black/20 text-white"
						/>
						<Input.Input
							type="email"
							placeholder="Email address"
							bind:value={newSupplier.email}
							class="bg-black/20 text-white"
						/>
						<div class="max-h-40 overflow-y-auto rounded-lg bg-black/20 p-2">
							{#each inventoryData as item}
								<label class="flex items-center space-x-2 py-1 text-white">
									<input
										type="checkbox"
										value={item.SKU}
										checked={newSupplier.skus.includes(item.SKU)}
										on:change={(e) => {
											if (e.currentTarget.checked) {
												newSupplier.skus = [...newSupplier.skus, item.SKU];
											} else {
												newSupplier.skus = newSupplier.skus.filter((sku) => sku !== item.SKU);
											}
										}}
									/>
									<span>{item.SKU} - {item.ProductName}</span>
								</label>
							{/each}
						</div>
						<div class="flex gap-2">
							<Button class="flex-1 bg-green-600 hover:bg-green-700" on:click={addSupplier}>
								Save
							</Button>
							<Button
								class="flex-1 bg-red-600 hover:bg-red-700"
								on:click={() => (showAddSupplier = false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			{/if}


			<!-- Recent Alerts -->
			<!-- <Card.Root class="border-green-500/20 bg-white/5 backdrop-blur-lg lg:col-span-2">
				<Card.Header>
					<Card.Title class="text-white">System Alerts</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#each ['Warehouse A inventory file processed successfully - 1,234 items updated', 'Low stock alert: 15 items below buffer stock level', 'New supplier contact details added for Electronics Supplier Ltd', "Voice agent 'Inventory-1' successfully deployed to Warehouse B"] as alert}
							<div class="flex items-center space-x-4 rounded-lg bg-green-500/5 p-3 text-gray-300">
								<div class="h-2 w-2 rounded-full bg-green-500"></div>
								<p>{alert}</p>
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root> -->
		</div>
	</div>
</div>

<style lang="postcss">
	:global(body) {
		@apply overflow-x-hidden;
	}
</style>
