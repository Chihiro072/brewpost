namespace BrewPost.Core.Interfaces;

public interface IBedrockService
{
    Task<string> GenerateContentAsync(string prompt);
}