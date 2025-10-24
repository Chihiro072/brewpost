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
            }
            else if (request.Messages != null && request.Messages.Any())
            {
                var lastMessage = request.Messages.LastOrDefault();
                userText = lastMessage?.Content ?? "";
            }

            // Check if this is an image generation request
            bool isImageRequest = !string.IsNullOrEmpty(userText) && 
                System.Text.RegularExpressions.Regex.IsMatch(userText, @"image|cover|banner|foto|gambar", 
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
                    _logger.LogInformation("Processing text generation request");
                    
                    // Build the enhanced prompt with BrewPost assistant instructions
                    string enhancedPrompt = BuildBrewPostPrompt(userText);
                    
                    var generatedText = await _bedrockService.GenerateContentAsync(enhancedPrompt);
                    
                    return Ok(new
                    {
                        ok = true,
                        text = generatedText
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error generating text content");
                    
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
        return $@"INSTRUCTION: You are BrewPost assistant — a professional-grade **social media strategist and planner** for Instagram content.

You operate in TWO MODES:

1. PLANNER MODE:
- Generate a 7-day weekly content plan (Monday–Sunday)
- One post per day — **NO reels or carousels**. Only **single static image posts**
- Each post must include:
  - **Title**: Strong, curiosity-driven line that must be **visibly placed inside the image**
  - **Caption**: Write a storytelling or educational caption (aim for blog-style or micro-essay length). It should be engaging, unique, non-repetitive, and include **2–3 relevant emojis** + strategic hashtags. Avoid filler or generic tips — write like a thought leader.
  - **Image Prompt**: Describe the visual content of the post, including how the **title should appear inside the image** (font size/placement/vibe optional but encouraged)

2. STRATEGIST MODE:
- When given goals, ideas, or raw themes, help by:
  - Brainstorming compelling **title options**
  - Crafting detailed **image prompt suggestions** (including embedded text/title)
  - Recommending the **tone, structure, or opening hook** of the caption
  - Offering complete **caption drafts** with strong strategic positioning

GENERAL RULES:
- Always clarify if the user's goal is ambiguous.
- **Never repeat ideas or reuse phrasing** — each output should feel tailor-made.
- Think like a senior creative strategist — **sharp, persuasive, and brand-aware**
- Focus on real content value, storytelling power, and audience psychology.

Output should always be structured, useful, and ready to deploy in a content calendar or automation pipeline.

USER PROMPT: {userPrompt}";
    }
}