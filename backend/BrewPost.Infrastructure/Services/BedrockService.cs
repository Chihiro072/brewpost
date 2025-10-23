using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;
using BrewPost.Core.Interfaces;

namespace BrewPost.Infrastructure.Services;

public class BedrockService : IBedrockService
{
    private readonly IAmazonBedrockRuntime _bedrockClient;
    private readonly IAmazonS3 _s3Client;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BedrockService> _logger;

    public BedrockService(IAmazonBedrockRuntime bedrockClient, IAmazonS3 s3Client, IConfiguration configuration, ILogger<BedrockService> logger)
    {
        _bedrockClient = bedrockClient;
        _s3Client = s3Client;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> GenerateContentAsync(string prompt)
    {
        try
        {
            // Try different casing for env vars (TEXT_MODEL or text_model)
            var textModel = _configuration["TEXT_MODEL"] 
                ?? _configuration["text_model"] 
                ?? _configuration["Bedrock:TextModel"];
            
            if (string.IsNullOrEmpty(textModel))
            {
                _logger.LogWarning("Bedrock TextModel not configured (TEXT_MODEL env var not found), using fallback response");
                return GenerateFallbackContent(prompt);
            }
            
            _logger.LogInformation("Using TEXT_MODEL: {Model}", textModel);

            var messages = new[]
            {
                new
                {
                    role = "user",
                    content = new[]
                    {
                        new { text = BuildContentPrompt(prompt) }
                    }
                }
            };

            var payload = new
            {
                messages = messages
                // Note: temperature, max_tokens, and top_p removed - not supported by Nova models
            };

            var jsonPayload = JsonSerializer.Serialize(payload);
            _logger.LogInformation("Sending request to Bedrock with model: {Model}", textModel);

            var request = new InvokeModelRequest
            {
                ModelId = textModel,
                Body = new MemoryStream(Encoding.UTF8.GetBytes(jsonPayload)),
                ContentType = "application/json"
            };

            var response = await _bedrockClient.InvokeModelAsync(request);
            
            using var reader = new StreamReader(response.Body);
            var responseJson = await reader.ReadToEndAsync();
            
            _logger.LogInformation("Received response from Bedrock");
            _logger.LogDebug("Response JSON: {Response}", responseJson);

            // Parse the response to extract the generated text
            var responseObj = JsonSerializer.Deserialize<JsonElement>(responseJson);
            
            // Try multiple response formats
            string? generatedText = null;
            
            // Format 1: Nova model response with "output" array
            if (responseObj.TryGetProperty("output", out var outputObj) && outputObj.TryGetProperty("message", out var messageObj))
            {
                if (messageObj.TryGetProperty("content", out var contentArray) && contentArray.GetArrayLength() > 0)
                {
                    var firstContent = contentArray[0];
                    if (firstContent.TryGetProperty("text", out var textElement))
                    {
                        generatedText = textElement.GetString();
        }
    }
}            // Format 2: Direct content array
            if (string.IsNullOrEmpty(generatedText) && responseObj.TryGetProperty("content", out var directContent) && directContent.GetArrayLength() > 0)
            {
                var firstContent = directContent[0];
                if (firstContent.TryGetProperty("text", out var textElement))
                {
                    generatedText = textElement.GetString();
                }
            }
            
            // Format 3: Direct text property
            if (string.IsNullOrEmpty(generatedText) && responseObj.TryGetProperty("text", out var directText))
            {
                generatedText = directText.GetString();
            }
            
            if (!string.IsNullOrEmpty(generatedText))
            {
                _logger.LogInformation("Successfully generated content from Bedrock");
                return generatedText;
            }
            
            _logger.LogWarning("Unexpected response format from Bedrock: {Response}", responseJson);
            throw new InvalidOperationException("Could not parse Bedrock response");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content from Bedrock: {Message}", ex.Message);
            
            // Check if it's an authorization error
            if (ex.Message.Contains("not authorized") || ex.Message.Contains("bedrock:InvokeModel"))
            {
                _logger.LogWarning("AWS Bedrock authorization failed. Please check IAM permissions for bedrock:InvokeModel");
            }
            
            // Check if it's a validation error (malformed request)
            if (ex.Message.Contains("Malformed") || ex.Message.Contains("ValidationException"))
            {
                _logger.LogError("Bedrock request validation failed. Check the request payload format.");
            }
            
            // Re-throw the exception instead of falling back to let the caller know something went wrong
            throw;
        }
    }

    private string GenerateFallbackContent(string prompt)
    {
        _logger.LogInformation("Generating fallback content for prompt: {Prompt}", prompt);
        
        return $@"## Post 1
**Title:** Content Strategy for {prompt}
**Caption:** Ready to elevate your content game? Let's dive into strategic planning that drives real engagement. Your audience is waiting for authentic, valuable content that speaks to their needs. 🚀 #ContentStrategy #DigitalMarketing #Growth

**Image Prompt:** Modern workspace with laptop displaying colorful analytics dashboard, coffee cup nearby, natural lighting from large window, clean minimalist desk setup with plants, professional yet approachable atmosphere.

## Post 2
**Title:** Building Your Brand Voice
**Caption:** Your brand voice is your digital personality. It's how you connect, engage, and build trust with your audience across every touchpoint. Consistency is key to memorable branding. ✨ #BrandVoice #Marketing #Branding

**Image Prompt:** Creative flat lay with brand style guide, color swatches, typography samples, and design elements arranged aesthetically on white background, soft shadows, professional photography style.

## Post 3
**Title:** Engagement That Converts
**Caption:** Great content doesn't just get likes—it drives action. Focus on creating value-driven posts that solve problems and inspire your audience to take the next step. 💡 #Engagement #ContentMarketing #Conversion

**Image Prompt:** Split screen showing social media engagement metrics on one side and real business results on the other, modern interface design, vibrant colors, data visualization elements.

## Post 4
**Title:** Visual Storytelling Mastery
**Caption:** A picture tells a thousand words, but the right picture tells your story. Master the art of visual communication to make your content unforgettable and shareable. 📸 #VisualStorytelling #ContentCreation #Design

**Image Prompt:** Behind-the-scenes photo shoot setup with professional lighting, camera equipment, styled props, photographer in action, creative studio environment with inspiring mood boards.

## Post 5
**Title:** Community Building Strategies
**Caption:** Your audience isn't just followers—they're your community. Build genuine relationships through consistent value, authentic interactions, and shared experiences. 🤝 #Community #SocialMedia #Relationships

**Image Prompt:** Diverse group of people collaborating around a large table with laptops and notebooks, warm lighting, collaborative atmosphere, modern office or co-working space setting.

## Post 6
**Title:** Content Calendar Success
**Caption:** Consistency beats perfection every time. A well-planned content calendar keeps you organized, on-brand, and ahead of the game. Plan your success! 📅 #ContentCalendar #Planning #Productivity

**Image Prompt:** Organized desk with physical calendar, colorful sticky notes, planning materials, laptop showing content management interface, neat and systematic layout, productivity-focused aesthetic.

## Post 7
**Title:** Measuring What Matters
**Caption:** Data doesn't lie, but it does tell stories. Learn to read your analytics and adjust your strategy based on what your audience actually wants and engages with. 📊 #Analytics #DataDriven #Strategy

**Image Prompt:** Multiple screens displaying various analytics dashboards, charts and graphs with upward trends, modern office setup, professional data analysis environment, clean and organized workspace.";
    }

    private string BuildContentPrompt(string userPrompt)
    {
        return $@"INSTRUCTION: You are BrewPost assistant. Generate content plans in this EXACT format:

## Post 1
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 2
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 3
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 4
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 5
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 6
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

## Post 7
**Title:** [Clean, professional title with NO emojis]
**Caption:** [Write a short, engaging caption in one brief paragraph (3-5 sentences max). Include one key insight. Add 2-3 emojis and hashtags.]
**Image Prompt:** [Detailed visual description including specific elements like lighting, composition, colors, style, mood, and any text overlays. Be specific about the setting, objects, people, and overall aesthetic. Make it 2-3 sentences long.]

RULES:
- Include storytelling, insights, and value in captions
- Add emojis and hashtags only in captions, not titles
- Make image prompts detailed and specific (2-3 sentences)
- NO extra explanations or introductions
- Start directly with ""## Post 1""

USER PROMPT: {userPrompt}";
    }

    public async Task<string> GenerateImageAsync(string prompt, string? nodeId = null)
    {
        try
        {
            // Try different casing for env vars (IMAGE_MODEL or image_model)
            var imageModel = _configuration["IMAGE_MODEL"] 
                ?? _configuration["image_model"] 
                ?? _configuration["Bedrock:ImageModel"] 
                ?? "amazon.nova-canvas-v1:0";
            
            var s3Bucket = _configuration["S3_BUCKET"] 
                ?? _configuration["AWS:S3BucketName"];
            
            _logger.LogInformation("Using IMAGE_MODEL: {Model}, S3_BUCKET: {Bucket}", imageModel, s3Bucket);

            if (string.IsNullOrEmpty(s3Bucket))
            {
                throw new InvalidOperationException("S3_BUCKET not configured");
            }

            if (string.IsNullOrEmpty(prompt))
            {
                throw new ArgumentException("Prompt cannot be empty", nameof(prompt));
            }

            // Truncate prompt if too long (Bedrock has limits)
            if (prompt.Length > 1000)
            {
                _logger.LogWarning("Prompt too long ({Length} chars), truncating to 1000", prompt.Length);
                prompt = prompt.Substring(0, 1000);
            }

            _logger.LogInformation("Generating image with model: {Model}, prompt: {Prompt}", imageModel, prompt.Substring(0, Math.Min(100, prompt.Length)));

            // Prepare Bedrock request payload
            var requestBody = new
            {
                taskType = "TEXT_IMAGE",
                textToImageParams = new { text = prompt },
                imageGenerationConfig = new
                {
                    seed = new Random().Next(858993460),
                    quality = "premium",
                    width = 1024,
                    height = 1024,
                    numberOfImages = 1
                }
            };

            var jsonPayload = JsonSerializer.Serialize(requestBody);
            _logger.LogDebug("Bedrock request payload: {Payload}", jsonPayload);

            // Invoke Bedrock model
            var invokeRequest = new InvokeModelRequest
            {
                ModelId = imageModel,
                Body = new MemoryStream(Encoding.UTF8.GetBytes(jsonPayload)),
                ContentType = "application/json",
                Accept = "application/json"
            };

            var response = await _bedrockClient.InvokeModelAsync(invokeRequest);

            // Parse response
            using var reader = new StreamReader(response.Body);
            var responseJson = await reader.ReadToEndAsync();
            _logger.LogDebug("Bedrock response received");

            var responseData = JsonSerializer.Deserialize<JsonElement>(responseJson);

            // Extract base64 image from response
            string? base64Image = null;
            if (responseData.TryGetProperty("images", out var images) && images.GetArrayLength() > 0)
            {
                base64Image = images[0].GetString();
            }
            else if (responseData.TryGetProperty("outputs", out var outputs) && outputs.GetArrayLength() > 0)
            {
                base64Image = outputs[0].GetProperty("body").GetString();
            }
            else if (responseData.TryGetProperty("b64_image", out var b64))
            {
                base64Image = b64.GetString();
            }
            else if (responseData.TryGetProperty("image_base64", out var imgB64))
            {
                base64Image = imgB64.GetString();
            }
            else if (responseData.TryGetProperty("base64", out var base64Prop))
            {
                base64Image = base64Prop.GetString();
            }

            if (string.IsNullOrEmpty(base64Image))
            {
                _logger.LogError("No base64 image found in Bedrock response");
                throw new InvalidOperationException("No base64 image found in Bedrock response");
            }

            // Clean base64 string
            base64Image = base64Image.Trim('"');

            // Convert to full data URL if needed
            if (!base64Image.StartsWith("data:"))
            {
                base64Image = $"data:image/png;base64,{base64Image}";
            }

            // Upload to S3
            var imageUrl = await UploadBase64ToS3Async(base64Image, s3Bucket, nodeId);

            _logger.LogInformation("Image generated successfully: {Url}", imageUrl);
            return imageUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating image with Bedrock");
            throw;
        }
    }

    private async Task<string> UploadBase64ToS3Async(string base64Data, string bucketName, string? nodeId = null)
    {
        try
        {
            // Parse base64 data
            var matches = System.Text.RegularExpressions.Regex.Match(base64Data, @"^data:(.+);base64,(.+)$");
            string mimeType = "image/png";
            string data = base64Data;
            string extension = "png";

            if (matches.Success)
            {
                mimeType = matches.Groups[1].Value;
                data = matches.Groups[2].Value;
                if (mimeType.Contains("jpeg") || mimeType.Contains("jpg"))
                {
                    extension = "jpg";
                }
            }
            else if (base64Data.Contains(","))
            {
                data = base64Data.Split(',')[1];
            }

            var buffer = Convert.FromBase64String(data);

            // Generate S3 key
            var keyPrefix = nodeId != null ? "node-images/" : "generated/";
            var key = $"{keyPrefix}{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}.{extension}";

            _logger.LogInformation("Uploading image to S3: {Bucket}/{Key}", bucketName, key);

            // Upload to S3
            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                InputStream = new MemoryStream(buffer),
                ContentType = mimeType
            };

            await _s3Client.PutObjectAsync(putRequest);

            // Generate presigned URL (valid for 10 days)
            var urlRequest = new GetPreSignedUrlRequest
            {
                BucketName = bucketName,
                Key = key,
                Expires = DateTime.UtcNow.AddDays(10)
            };

            var presignedUrl = _s3Client.GetPreSignedURL(urlRequest);

            _logger.LogInformation("Image uploaded successfully to S3");
            return presignedUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading image to S3");
            throw;
        }
    }
}