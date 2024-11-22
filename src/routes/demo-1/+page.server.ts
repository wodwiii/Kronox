import type { PageServerLoad } from './$types';
import { generateDeepgramKey } from '$services/generateKey.server';

export const load: PageServerLoad = async () => {
    const result = await generateDeepgramKey();
    
    if (!result.success) {
        // Handle error case
        throw new Error(result.error);
    }

    return {
        deepgramKey: result.key
    };
};
