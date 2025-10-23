using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;
using BrewPost.Core.Interfaces;

namespace BrewPost.Infrastructure.Services;

public class BedrockService : IBedrockService
{
    private readonly IAmazonBedrockRuntime _bedrockClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BedrockService> _logger;

    public BedrockService(IAmazonBedrockRuntime bedrockClient, IConfiguration configuration, ILogger<BedrockService> logger)
    {
        _bedrockClient = bedrockClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> GenerateContentAsync(string prompt)
    {
        try
        {
            var textModel = _configuration["Bedrock:TextModel"];
            if (string.IsNullOrEmpty(textModel))
            {
                _logger.LogWarning("Bedrock TextModel not configured, using fallback response");
                return GenerateFallbackContent(prompt);
            }

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
                messages = messages,
                max_tokens = 4000,
                temperature = 0.7,
                top_p = 0.9
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

            // Parse the response to extract the generated text
            var responseObj = JsonSerializer.Deserialize<JsonElement>(responseJson);
            
            if (responseObj.TryGetProperty("content", out var contentArray) && contentArray.GetArrayLength() > 0)
            {
                var firstContent = contentArray[0];
                if (firstContent.TryGetProperty("text", out var textElement))
                {
                    return textElement.GetString() ?? string.Empty;
                }
            }

            _logger.LogWarning("Unexpected response format from Bedrock: {Response}", responseJson);
            return GenerateFallbackContent(prompt);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content from Bedrock: {Message}. Using fallback response.", ex.Message);
            
            // Check if it's an authorization error
            if (ex.Message.Contains("not authorized") || ex.Message.Contains("bedrock:InvokeModel"))
            {
                _logger.LogWarning("AWS Bedrock authorization failed. Please check IAM permissions for bedrock:InvokeModel");
            }
            
            return GenerateFallbackContent(prompt);
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
}