using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class Asset
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Filename { get; set; } = string.Empty;
    
    [Required]
    public string FileUrl { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string FileType { get; set; } = string.Empty;
    
    [Required]
    public int FileSize { get; set; }
    
    [MaxLength(500)]
    public string? S3Key { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument Metadata { get; set; } = JsonDocument.Parse("{}");
    
    [Column(TypeName = "text[]")]
    public string[] Tags { get; set; } = Array.Empty<string>();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;
    
    public virtual ICollection<PostAsset> PostAssets { get; set; } = new List<PostAsset>();
}