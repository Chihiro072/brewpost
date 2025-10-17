using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class SocialAccount
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Provider { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(255)]
    public string ProviderId { get; set; } = string.Empty;
    
    public string? AccessToken { get; set; }
    
    public string? RefreshToken { get; set; }
    
    public DateTime? ExpiresAt { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument ProfileData { get; set; } = JsonDocument.Parse("{}");
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;
}