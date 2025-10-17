using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class GeneratedImage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid PostId { get; set; }
    
    public Guid? TemplateId { get; set; }
    
    [Required]
    public string ImageUrl { get; set; } = string.Empty;
    
    public string? GenerationPrompt { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument GenerationParams { get; set; } = JsonDocument.Parse("{}");
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(PostId))]
    public virtual Post Post { get; set; } = null!;
    
    [ForeignKey(nameof(TemplateId))]
    public virtual Template? Template { get; set; }
}