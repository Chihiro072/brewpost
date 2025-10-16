// postingService.ts (Function URL path)
// COMMENTED OUT: Backend disabled
// const LAMBDA_FUNCTION_URL = "https://ilytuzdhum5h2pec6jgy5vnm2m0lmsoz.lambda-url.us-east-1.on.aws/";

interface PostResponse {
  ok: boolean;
  tweetId?: string;
  postId?: string; // For LinkedIn
  id?: string; // Alternative field name for tweet ID
  error?: string;
  rate?: { retryAfterSec?: number | null; resetEpochSec?: number | null; remaining?: number | null };
  details?: any;
}

export class PostingService {
  private static inFlight = false;

  static async postToX(text: string): Promise<PostResponse> {
    // COMMENTED OUT: Backend disabled - returning mock success
    console.log('[MOCK] PostToX called with text:', text);
    return { ok: true, tweetId: 'mock-' + Date.now() };
    
    // if (this.inFlight) {
    //   return { ok: false, error: "A post is already in progress. Please wait." };
    // }
    // this.inFlight = true;
    // try {
    //   const res = await fetch(LAMBDA_FUNCTION_URL, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       // If you set WEBHOOK_SECRET in Lambda, uncomment and add the secret:
    //       // "x-webhook-secret": "your-webhook-secret-here"
    //     },
    //     body: JSON.stringify({ text })
    //   });
    //   const body: PostResponse = await res.json().catch(() => ({ ok: false, error: "Bad JSON from Lambda" }));
    //   // Handle rate limiting (429)
    //   if (res.status === 429) {
    //     const retryIn =
    //       body?.rate?.retryAfterSec ??
    //       (body?.rate?.resetEpochSec ? Math.max(0, body.rate.resetEpochSec - Math.floor(Date.now() / 1000)) : null);
    //     const friendly = retryIn ? `Rate-limited. Try again in ~${Math.ceil(retryIn)}s.` : "Rate-limited. Try later.";
    //     return { ok: false, error: friendly, rate: body.rate, details: body.details };
    //   }
    //   // If status is 200 (OK), ensure we return success even if body.ok is not explicitly true
    //   if (res.status === 200) {
    //     return { 
    //       ok: true, 
    //       tweetId: body.tweetId || body.id || "posted", 
    //       ...body 
    //     };
    //   }
    //   // For other status codes, return the body as-is or mark as failed
    //   if (!res.ok) {
    //     return { 
    //       ok: false, 
    //       error: body.error || `HTTP ${res.status}: ${res.statusText}`,
    //       details: body 
    //     };
    //   }
    //   return body;
    // } finally {
    //   this.inFlight = false;
    // }
  }

  static async postToLinkedIn(text: string): Promise<PostResponse> {
    // COMMENTED OUT: Backend disabled - returning mock success
    console.log('[MOCK] PostToLinkedIn called with text:', text);
    return { ok: true, postId: 'linkedin-mock-' + Date.now() };
    
    // TODO: Implement actual LinkedIn posting when backend is enabled
    // Similar structure to postToX but for LinkedIn API endpoint
  }
}