namespace BrewPost.Core.Interfaces;

public interface IBedrockService
{
    Task<string> GenerateContentAsync(string prompt);
    Task<string> GenerateImageAsync(string prompt, string? nodeId = null);
}