namespace BrewPost.API.DTOs;

public class GenerateComponentsRequest
{
    public ContentNodeDto? Node { get; set; }
}

public class ContentNodeDto
{
    public string? Id { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? ImagePrompt { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public string? Status { get; set; }
}

public class GeneratedComponentDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Description { get; set; }
    public object? Data { get; set; }
    public string? Category { get; set; }
    public string[]? Keywords { get; set; }
    public double? RelevanceScore { get; set; }
    public string? Impact { get; set; }
    public string? Color { get; set; }
}