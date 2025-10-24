namespace BrewPost.Core.DTOs;

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