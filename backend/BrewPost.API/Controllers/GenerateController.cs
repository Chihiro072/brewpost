using Microsoft.AspNetCore.Mvc;
using BrewPost.Core.Interfaces;
using BrewPost.API.DTOs;
using System.Text.Json;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenerateController : ControllerBase
{
    private readonly IBedrockService _bedrockService;
    private readonly ILogger<GenerateController> _logger;

    public GenerateController(IBedrockService bedrockService, ILogger<GenerateController> logger)
    {
        _bedrockService = bedrockService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { error = "Request body is required" });
            }

            // Validate request
            if (string.IsNullOrEmpty(request.Prompt) && (request.Messages == null || !request.Messages.Any()))
            {
                return BadRequest(new { error = "Provide prompt or messages." });
            }

            // Extract user text from prompt or messages
            string userText = "";
            if (!string.IsNullOrEmpty(request.Prompt))
            {
                userText = request.Prompt;
                
                // If the prompt contains multiple "User:" and "Assistant:" entries (chat history),
                // extract just the last user message to avoid overwhelming Bedrock
                if (userText.Contains("User:") && userText.Contains("Assistant:"))
                {
                    _logger.LogInformation("Detected chat history in prompt, extracting last user message");
                    
                    // Split by "User:" and get the last entry
                    var userMessages = userText.Split(new[] { "User:" }, StringSplitOptions.None);
                    if (userMessages.Length > 1)
                    {
                        // Get the last user message (everything after the last "User:")
                        var lastUserMessage = userMessages[userMessages.Length - 1].Trim();
                        
                        // If this message contains "Assistant:" (meaning there's a response after it),
                        // extract just the user part
                        if (lastUserMessage.Contains("Assistant:"))
                        {
                            lastUserMessage = lastUserMessage.Split(new[] { "Assistant:" }, StringSplitOptions.None)[0].Trim();
                        }
                        
                        _logger.LogInformation("Extracted last user message: {Message}", lastUserMessage);
                        userText = lastUserMessage;
                    }
                }
            }
            else if (request.Messages != null && request.Messages.Any())
            {
                var lastMessage = request.Messages.LastOrDefault();
                userText = lastMessage?.Content ?? "";
            }

            // Check if this is an image generation request
            bool isImageRequest = !string.IsNullOrEmpty(userText) && 
                System.Text.RegularExpressions.Regex.IsMatch(userText, @"\b(image|cover|banner|foto|gambar)\b", 
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            if (isImageRequest)
            {
                try
                {
                    _logger.LogInformation("Processing image generation request");
                    var imageUrl = await _bedrockService.GenerateImageAsync(userText);
                    
                    return Ok(new
                    {
                        ok = true,
                        imageUrl = imageUrl
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error generating image");
                    
                    if (ex.Message.Contains("403") || ex.Message.Contains("not authorized"))
                    {
                        return StatusCode(403, new { error = "403 - Access denied to model", detail = ex.Message });
                    }
                    
                    return StatusCode(500, new { error = "image_generation_failed", detail = ex.Message });
                }
            }
            else
            {
                try
                {
                    _logger.LogInformation("Processing text generation request for userText: {UserText}", userText);

                    // Build the enhanced prompt for logging/debugging only. The Bedrock service
                    // will build its own final payload; we pass the raw user text to the service.
                    string enhancedPrompt = BuildBrewPostPrompt(userText);
                    _logger.LogDebug("Enhanced prompt preview: {Preview}",
                        enhancedPrompt?.Substring(0, Math.Min(800, enhancedPrompt.Length)));

                    _logger.LogInformation("Calling BedrockService.GenerateContentAsync with prompt: {Prompt}", userText);
                    var generatedText = await _bedrockService.GenerateContentAsync(userText);
                    
                    _logger.LogInformation("Successfully generated text, length: {Length}", generatedText?.Length ?? 0);

                    return Ok(new
                    {
                        ok = true,
                        text = generatedText
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error generating text content: {ExceptionMessage}", ex.Message);
                    _logger.LogError("Exception type: {ExceptionType}, StackTrace: {StackTrace}", ex.GetType().Name, ex.StackTrace);
                    
                    if (ex.Message.Contains("403") || ex.Message.Contains("not authorized"))
                    {
                        return StatusCode(403, new { error = "403 - Access denied to model", detail = ex.Message });
                    }
                    
                    return StatusCode(500, new { error = "text_generation_failed", detail = ex.Message });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in Generate endpoint");
            return StatusCode(500, new { error = "generate_failed", detail = ex.Message });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { ok = true, pid = Environment.ProcessId });
    }

    private string BuildBrewPostPrompt(string userPrompt)
    {
        return $@"You are BrewPost assistant, a social media strategy tool.

IMPORTANT - DETECT THE USER'S INTENT FIRST:

1. If the user is making CASUAL CONVERSATION (greeting, asking about you, small talk like 'hi', 'hello', 'how are you', 'what is brewpost'):
   - Respond naturally and briefly in conversation mode
   - Do NOT generate a planner
   - Example: User says 'Hi!' → You respond 'Hi there! How can I help you create amazing content today?'

2. If the user is asking for CONTENT PLANNING (contains words like 'plan', 'content', 'posts', 'strategy', 'create posts for', 'generate content for', 'social media plan'):
   - Generate a 7-day content planner with 7 posts
   - Each post must have: Title, Caption, Image Prompt
   - Start with '## Post 1' and include all 7 posts
   - Example: User says 'Plan content for coffee shop' → Generate full 7-post planner

3. If the user is asking for IDEAS/SUGGESTIONS (contains words like 'ideas', 'suggestions', 'brainstorm', 'help with', 'advice', 'tips'):
   - Provide helpful brainstorming or advice
   - Do NOT generate a full planner
   - Example: User says 'Ideas for Instagram posts' → Suggest 3-5 topic ideas

CRITICAL RULE: 
- ONLY generate a 7-post planner (starting with '## Post 1') when the user explicitly asks for content planning, posts, or strategy
- For greetings and casual chat, respond conversationally without any planner format
- For advice/ideas requests, provide suggestions in paragraph form

USER MESSAGE: {userPrompt}";
    }
}