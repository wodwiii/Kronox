import { json, type RequestHandler } from '@sveltejs/kit';
import { AzureChatOpenAI } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { z } from 'zod';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4xpOp0vfeDU08N4sYEz6TfmWQIVv8WNc",
    authDomain: "neohyre.firebaseapp.com", 
    databaseURL: "https://neohyre-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "neohyre",
    storageBucket: "neohyre.appspot.com",
    messagingSenderId: "450641500811",
    appId: "1:450641500811:web:63154eda36f9aa5a39528e",
    measurementId: "G-KRV0RH14MG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Order schema
const orderSchema = z.object({
    productName: z.string().describe("Name of the product ordered"),
    quantity: z.number().positive().describe("Quantity ordered"),
    address: z.string().describe("Delivery address"),
    paymentMode: z.enum(['card', 'cash_on_delivery']).describe("Payment method"),
    timestamp: z.string(),
    sessionId: z.string()
});

// Initialize Azure Speech config
const speechConfig = sdk.SpeechConfig.fromSubscription(
    import.meta.env.VITE_AZURE_SPEECH_KEY, 
    'southeastasia'
);
speechConfig.speechSynthesisVoiceName = 'en-US-CoraMultilingualNeural';
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3;

const model = new AzureChatOpenAI({
    temperature: 0.25,
    model: 'gpt-4o-mini',
    maxRetries: 2,
    azureOpenAIApiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: import.meta.env.VITE_AZURE_OPENAI_API_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: import.meta.env.VITE_AZURE_OPENAI_API_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION,
});

const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

const customerServicePrompt = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are Sarah, a friendly and professional customer service representative for {companyName}.
        CRITICAL INSTRUCTION: KEEP ALL RESPONSES EXTREMELY SHORT AND CONCISE. LIMIT EACH RESPONSE TO 1-2 SENTENCES MAXIMUM. 

        Key Information:
        - Business Hours: {customerServiceHours}
        - Available Products:
        {products}

        Guidelines:
        - Start by warmly introducing yourself and the company
        - Be helpful, patient, and empathetic in your responses
        - Provide accurate product information including prices, availability, and features
        - Keep responses concise but informative
        - Use a natural, conversational tone
        - If you don't know something, be honest about it
        - Handle customer concerns professionally
        - End conversations politely

        When collecting order details, wrap them in <OrderDetails> tags using this format:
        <OrderDetails>
        PRODUCT::product name
        QUANTITY::number
        ADDRESS::delivery address
        PAYMENT::card or cash_on_delivery
        </OrderDetails>

        Remember to:
        - Make every response short and concise. Do not talk too much.
        - Listen carefully to customer queries
        - Provide relevant product recommendations when appropriate
        - Explain policies clearly
        - Thank customers for their patience and business
        - Be upfront about being an AI assistant`
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}']
]);

const chain = customerServicePrompt.pipe(model);

const withMessageHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId: string) => {
        if (messageHistories[sessionId] === undefined) {
            messageHistories[sessionId] = new InMemoryChatMessageHistory();
        }
        return messageHistories[sessionId];
    },
    inputMessagesKey: 'input',
    historyMessagesKey: 'chat_history'
});

// Function to extract and validate order details
const extractOrderDetails = (text: string) => {
    const detailsMatch = text.match(/<OrderDetails>([\s\S]*?)<\/OrderDetails>/);
    if (detailsMatch) {
        try {
            const detailsText = detailsMatch[1].trim();
            const details: Record<string, any> = {};
            
            const lines = detailsText.split('\n');
            lines.forEach(line => {
                const [key, value] = line.trim().split('::');
                if (key && value) {
                    switch(key) {
                        case 'PRODUCT':
                            details.productName = value;
                            break;
                        case 'QUANTITY':
                            details.quantity = parseInt(value);
                            break;
                        case 'ADDRESS':
                            details.address = value;
                            break;
                        case 'PAYMENT':
                            details.paymentMode = value;
                            break;
                    }
                }
            });

            return orderSchema.parse({
                ...details,
                timestamp: new Date().toISOString(),
                sessionId: ''  // Will be filled in later
            });
        } catch (error) {
            console.error('Error parsing order details:', error);
            return null;
        }
    }
    return null;
};

// Function to save order to Firebase
const saveOrderToFirebase = async (orderDetails: z.infer<typeof orderSchema>) => {
    try {
        const ordersRef = ref(database, 'customer_orders');
        const newOrderRef = push(ordersRef);
        await set(newOrderRef, orderDetails);
        console.log('Order saved with reference ID:', newOrderRef.key);
        return newOrderRef.key;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
};

// Helper function to synthesize speech
const synthesizeSpeech = async (text: string): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
        synthesizer.speakTextAsync(
            text,
            (result) => {
                if (result) {
                    const audioData = result.audioData;
                    synthesizer.close();
                    if (audioData && audioData.byteLength > 0) {
                        resolve(new Uint8Array(audioData));
                    } else {
                        reject(new Error('No audio data received'));
                    }
                } else {
                    synthesizer.close();
                    reject(new Error('Speech synthesis failed'));
                }
            },
            (error) => {
                synthesizer.close();
                reject(error);
            }
        );
    });
};

type CustomerServiceRequest = {
    input: string;
    products: string[];
    sessionId: string;
    isStart: boolean;
    companyName: string;
    customerServiceHours: string;
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        let { input, products, sessionId, isStart, companyName, customerServiceHours } = 
            (await request.json()) as CustomerServiceRequest;
        console.log(input);
        const config = {
            configurable: {
                sessionId
            }
        };
        if(isStart) {
            input = "Call connected..."
        }
        console.time('invoke');
        const response = await withMessageHistory.invoke(
            {
                input,
                products,
                companyName,
                customerServiceHours
            },
            config
        );
        console.timeEnd('invoke');

        let responseText = response.content as string;

        // Check for order details and save to Firebase if present
        const detailsMatch = responseText.match(/<OrderDetails>[\s\S]*?<\/OrderDetails>/);
        if (detailsMatch) {
            const orderDetails = extractOrderDetails(responseText);
            if (orderDetails) {
                orderDetails.sessionId = sessionId;
                await saveOrderToFirebase(orderDetails);
                responseText = responseText.replace(detailsMatch[0], "I've recorded your order.");
            }
        }

        console.time('audio');
        const audioData = await synthesizeSpeech(responseText);
        console.timeEnd('audio');

        return new Response(audioData, {
            headers: {
                'Content-Type': 'audio/wav',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error('Detailed error:', error);
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
};