<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Bot, Loader2, Mic, Sparkles } from 'lucide-svelte';
	import { AudioRecorder } from '$utils/audioRecorder';
	import { TranscriptProcessor } from '$utils/transcriptProcessor';
	import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
	import type { PageData } from './$types';

	export let data: PageData;
	const agentId = $page.params.agentId;

    let products: string[] = [];
    let companyName: string = "TechCorp Electronics";
    let supplierName: string = "Global Electronics Supply Co.";
    let supplierContact: string = "+1 (555) 123-4567";
    let expectedDeliveryDate: string = "2024-12-15";
    let showSetupForm = true;
    let additionalNotes = "Handle with care - Contains sensitive electronic components";
    let productInputs: {name: string, quantity: number, unit: string}[] = [
        {name: "4K LCD Display Panels", quantity: 50, unit: "units"},
        {name: "Wireless Router Modules", quantity: 200, unit: "units"},
        {name: "SSD Storage Drives 1TB", quantity: 150, unit: "units"},
        {name: "RGB Mechanical Keyboards", quantity: 100, unit: "units"},
        {name: "Gaming Graphics Cards", quantity: 75, unit: "units"}
    ];

	let isInitializing = true;
	let canvas: HTMLCanvasElement;
	let audioContext: AudioContext;
	let analyser: AnalyserNode;
	let dataArray: Uint8Array;
	let canvasCtx: CanvasRenderingContext2D;
	let animationFrame: number;
	let isAITalking = false;
	let isProcessingResponse = false;
	let isConnected = false;
	let stream: MediaStream | null;

	// Audio context for mixing
	let mixedDestination: MediaStreamAudioDestinationNode;
	let receivedAudioSource: AudioBufferSourceNode;

	// Deepgram variables
	let deepgram_client: any;
	let connection: any;
	let audioRecorder: AudioRecorder | null = null;
	const transcriptProcessor = new TranscriptProcessor();
	let currentTranscript = '';
	let wholeTranscript = '';
	let sessionId = crypto.randomUUID();

    const addProductInput = () => {
        productInputs = [...productInputs, {name: "", quantity: 0, unit: "units"}];
    };

    const removeProductInput = (index: number) => {
        productInputs = productInputs.filter((_, i) => i !== index);
    };

    const startDemo = () => {
        if (!companyName || !supplierName || !supplierContact || !expectedDeliveryDate || 
            productInputs.some(p => !p.name || p.quantity <= 0)) {
            alert("Please fill in all required fields");
            return;
        }
        
        products = productInputs.map(p => `${p.name} (Quantity: ${p.quantity} ${p.unit})`);
        showSetupForm = false;
        initializeCanvas();
        initializeAudio();
    };

	const initializeCanvas = () => {
		if (!canvas) return false;

		canvasCtx = canvas.getContext('2d')!;
		canvas.width = canvas.offsetWidth * 2;
		canvas.height = canvas.offsetHeight * 2;
		canvas.style.width = `${canvas.offsetWidth}px`;
		canvas.style.height = `${canvas.offsetHeight}px`;
		return true;
	};

	const initializeAudio = async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioContext = new AudioContext();
			analyser = audioContext.createAnalyser();
			mixedDestination = audioContext.createMediaStreamDestination();
			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);
			source.connect(mixedDestination);
			analyser.fftSize = 512;
			const bufferLength = analyser.frequencyBinCount;
			dataArray = new Uint8Array(bufferLength);
            
			// If canvas is already initialized, start drawing
			if (canvasCtx) {
				draw();
			}

			// Initialize Deepgram after audio setup
			await connectToDeepgram();
            await generateResponse(true);
		} catch (err) {
			console.error('Error accessing microphone:', err);
		}
	};

	const draw = () => {
		if (!canvasCtx) return;

		const width = canvas.width;
		const height = canvas.height;
		const centerX = width / 2;
		const centerY = height / 2;

		animationFrame = requestAnimationFrame(draw);
		analyser.getByteFrequencyData(dataArray);

		canvasCtx.clearRect(0, 0, width, height);

		// Draw circular visualizer around microphone
		const bars = 180;
		const radius = Math.min(width, height) * 0.18; // Radius for wave position
		const barWidth = 3;

		for (let i = 0; i < bars; i++) {
			const value = dataArray[i] || 0;
			const percent = value / 255;
			const barHeight = radius * percent * 0.8;
			const angle = (i * Math.PI * 2) / bars;

			const x1 = centerX + Math.cos(angle) * (radius * 1.2); // Outer circle
			const y1 = centerY + Math.sin(angle) * (radius * 1.2);
			const x2 = centerX + Math.cos(angle) * (radius * 1.2 + barHeight);
			const y2 = centerY + Math.sin(angle) * (radius * 1.2 + barHeight);

			canvasCtx.beginPath();
			canvasCtx.moveTo(x1, y1);
			canvasCtx.lineTo(x2, y2);
			canvasCtx.lineWidth = barWidth;
			canvasCtx.lineCap = 'round';

			// Create gradient
			const gradient = canvasCtx.createLinearGradient(x1, y1, x2, y2);
			if (!isAITalking) {
				gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
				gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');
			} else {
				gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
				gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');
			}

			canvasCtx.strokeStyle = gradient;
			canvasCtx.stroke();
		}
	};

	onMount(async () => {
		setTimeout(() => {
			isInitializing = false;
		}, 2000);
	});

	$: if (canvas && !canvasCtx && !showSetupForm) {
		initializeCanvas();
		initializeAudio();
	}

	const connectToDeepgram = async () => {
		deepgram_client = createClient(data.deepgramKey);
		connection = deepgram_client.listen.live({
			model: 'nova-2',
			language: 'en-US',
			smart_format: true,
			encoding: 'linear16',
			channels: 1,
			sample_rate: 44000,
			filler_words: true,
			interim_results: true,
			utterance_end_ms: 1000,
			vad_events: true,
			endpointing: 100
		});

		connection.on(LiveTranscriptionEvents.Open, async () => {
			isConnected = true;
			if (stream && !audioRecorder) {
				audioRecorder = new AudioRecorder(connection);
				await audioRecorder.initialize(stream);
				// Start recording immediately
				audioRecorder.start();
			}
		});

		connection.on(LiveTranscriptionEvents.UtteranceEnd, async () => {
			if (!isAITalking && !isProcessingResponse) {
				await generateResponse();
				transcriptProcessor.reset();
			}
		});

		connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
			currentTranscript = transcriptProcessor.processTranscript(data);
			console.log(currentTranscript);
			if (currentTranscript !== '') {
				wholeTranscript += ' ' + currentTranscript;
			}
		});
	};

	const generateResponse = async (isStart: boolean) => {
		if (isProcessingResponse) return;

		isProcessingResponse = true;
		isAITalking = true;

		try {
			const response = await fetch('/api/chat-1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input: wholeTranscript,
					agentId,
					sessionId,
                    products,
                    companyName,
                    supplierName,
                    supplierContact,
                    expectedDeliveryDate,
                    isStart,
				})
			});

			const audioData = await response.arrayBuffer();
			const decodedData = await audioContext.decodeAudioData(audioData);

			if (receivedAudioSource) {
				receivedAudioSource.stop();
			}

			receivedAudioSource = audioContext.createBufferSource();
			receivedAudioSource.buffer = decodedData;
			receivedAudioSource.connect(mixedDestination);
			receivedAudioSource.connect(audioContext.destination);
			receivedAudioSource.start();

			receivedAudioSource.onended = () => {
				isAITalking = false;
				isProcessingResponse = false;
			};

			wholeTranscript = '';
		} catch (error) {
			console.error('Error generating response:', error);
			isAITalking = false;
			isProcessingResponse = false;
		}
	};

	const goBack = () => {
		goto('/');
	};

	onDestroy(() => {
		if (connection) {
			connection.requestClose();
			connection.disconnect();
		}
		if (audioRecorder) {
			audioRecorder.cleanup();
		}
		if (audioContext) {
			audioContext.close();
		}
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});
</script>

<div class="relative min-h-screen">
	<!-- Mesh Gradient Background -->
	<div class="bg-mesh fixed inset-0"></div>

	<!-- Gradient Orbs -->
	<div
		class="fixed left-0 top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/30 blur-[128px]"
	></div>
	<div
		class="fixed right-0 top-0 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/2 rounded-full bg-green-500/30 blur-[128px]"
	></div>
	<div
		class="fixed bottom-0 left-1/2 h-[800px] w-[800px] -translate-x-1/2 translate-y-1/2 rounded-full bg-green-500/30 blur-[128px]"
	></div>

	<div class="relative z-10">
		{#if isInitializing}
			<div class="flex h-screen flex-col items-center justify-center p-6">
				<div
					class="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl"
				>
					<div class="flex flex-col items-center">
						<Loader2 class="mb-4 h-12 w-12 animate-spin text-green-400" />
						<h2 class="mb-2 text-2xl font-semibold text-white">Initializing Demo</h2>
						<p class="text-center text-white/70">Setting up your AI Voice Agent...</p>
						<p class="mt-4 text-center text-sm text-white/70">
							This is a demo of how the AI would handle warehouse notifications for incoming stock. Please act as the supplier.
						</p>
					</div>
				</div>
			</div>
		{:else if showSetupForm}
			<div class="flex flex-col items-center justify-center p-6">
				<div class="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
					<h2 class="mb-6 text-2xl font-semibold text-white">Setup Warehouse Notification</h2>
					
					<div class="mb-6 rounded-lg bg-yellow-500/10 p-4 text-yellow-300">
						<p class="text-sm">Note: This manual input form is for demonstration purposes only. In a production environment, this data would be automatically pulled from your supplier management system.</p>
						<p class="mt-2 text-sm">Also, Twilio integration will be implemented to enable real phone number dialing and call handling.</p>
					</div>

					<div class="mb-4">
						<label class="mb-2 block text-sm font-medium text-white">Company Name</label>
						<input
							type="text"
							bind:value={companyName}
							class="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
							placeholder="Enter company name"
						/>
					</div>

                    <div class="mb-4">
                        <label class="mb-2 block text-sm font-medium text-white">Supplier Details</label>
                        <input
                            type="text"
                            bind:value={supplierName}
                            class="mb-2 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
                            placeholder="Supplier name"
                        />
                        <input
                            type="text"
                            bind:value={supplierContact}
                            class="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
                            placeholder="Supplier contact number"
                        />
                    </div>

                    <div class="mb-4">
                        <label class="mb-2 block text-sm font-medium text-white">Expected Delivery Date</label>
                        <input
                            type="date"
                            bind:value={expectedDeliveryDate}
                            class="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
                        />
                    </div>

					<div class="mb-4">
						<label class="mb-2 block text-sm font-medium text-white">Incoming Products</label>
						{#each productInputs as product, i}
							<div class="mb-2 flex gap-2">
								<input
									type="text"
									bind:value={product.name}
									placeholder="Product name"
									class="flex-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
								/>
								<input
									type="number"
									bind:value={product.quantity}
									placeholder="Qty"
									class="w-24 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
									min="1"
								/>
                                <select
                                    bind:value={product.unit}
                                    class="w-24 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
                                >
                                    <option value="units">Units</option>
                                    <option value="boxes">Boxes</option>
                                    <option value="pallets">Pallets</option>
                                    <option value="kg">KG</option>
                                </select>
								{#if productInputs.length > 1}
									<button
										on:click={() => removeProductInput(i)}
										class="rounded-lg bg-red-500/20 px-3 text-red-300 hover:bg-red-500/30"
									>
										×
									</button>
								{/if}
							</div>
						{/each}
						<button
							on:click={addProductInput}
							class="mt-2 rounded-lg bg-green-500/20 px-4 py-2 text-sm text-green-300 hover:bg-green-500/30"
						>
							+ Add Product
						</button>
					</div>

					<div class="mb-6">
						<label class="mb-2 block text-sm font-medium text-white">Additional Notes</label>
						<textarea
							bind:value={additionalNotes}
							class="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white"
							rows="3"
							placeholder="Special handling instructions, storage requirements, etc."
						></textarea>
					</div>

					<button
						on:click={startDemo}
						class="w-full rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700"
					>
						Start Notification Call
					</button>
				</div>
			</div>
		{:else}
			<div class="min-h-screen">
				<!-- Header -->
				<header class="border-b border-white/10 bg-white/5 p-4 backdrop-blur-xl ">
					<div class="mx-auto flex max-w-4xl items-center justify-between">
						<div class="flex items-center space-x-4">
							<button on:click={goBack} class="rounded-xl p-2 transition-colors hover:bg-white/10">
								<ArrowLeft class="h-6 w-6 text-white/70" />
							</button>
							<div class="flex items-center space-x-3">
								<div class="rounded-xl border border-white/10 bg-white/10 p-2.5">
									<Bot class="h-6 w-6 text-green-300" />
								</div>
								<h1 class="text-xl font-semibold text-white">Warehouse Notification Agent</h1>
							</div>
						</div>
						<div
							class="hidden md:block flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-sm text-white/70 backdrop-blur-xl"
						>
							<Sparkles class="h-4 w-4" />
							Demo Mode
						</div>
					</div>
				</header>

				<!-- Main Content Area -->
				<div class="flex flex-1 flex-col items-center justify-center p-8">
					<!-- Combined Microphone and Visualization Container -->
					<div class="relative mb-8 flex h-[500px] w-[500px] items-center justify-center">
						<!-- Canvas for Visualization -->
						<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>

						<!-- Static Microphone Icon -->
						<div class="relative z-10">
							<div class="absolute inset-0 rounded-full bg-green-500/30 opacity-70 blur-2xl"></div>
							<div
								class="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 backdrop-blur-xl"
							>
								<div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
								<Mic class="relative z-10 h-12 w-12 text-green-300" />
							</div>
						</div>
					</div>
                   
					<!-- Status Text -->
					<p class="text-xl font-light text-white/70">
						{#if isAITalking}
							AI Speaking...
						{:else}
							Listening...
						{/if}
					</p>
                    <div class="text-yellow-300 italic text-sm bg-white/20 rounded-full px-4 py-2 mt-8"> Twilio integration will be implemented to enable real phone number dialing and call handling.</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	/* Mesh Gradient Background */
	.bg-mesh {
		background: radial-gradient(at 0% 0%, rgb(34, 197, 94) 0px, transparent 50%),
			radial-gradient(at 98% 1%, rgb(34, 197, 94) 0px, transparent 50%),
			radial-gradient(at 50% 50%, rgb(34, 197, 94) 0px, transparent 50%);
		background-color: rgb(23, 23, 23);
	}
</style>
