namespace BrewPost.API.DTOs;

public class GenerateRequest
{
    public string? Prompt { get; set; }
    public List<MessageDto>? Messages { get; set; }
}

public class MessageDto
{
    public string Type { get; set; } = "";
    public string Content { get; set; } = "";
    public string Role { get; set; } = "";
}