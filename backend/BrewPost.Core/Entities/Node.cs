using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace BrewPost.Core.Entities;

public class Node
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Title { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = "post"; // 'post', 'image', 'story'
    
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "draft"; // 'draft', 'scheduled', 'published'
    
    public DateTime? ScheduledDate { get; set; }
    
    [Required]
    public string Content { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? ImageUrl { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument? ImageUrls { get; set; }
    
    [MaxLength(1000)]
    public string? ImagePrompt { get; set; }
    
    [MaxLength(50)]
    public string? Day { get; set; }
    
    [MaxLength(50)]
    public string? PostType { get; set; } // 'engaging', 'promotional', 'branding'
    
    [MaxLength(255)]
    public string? Focus { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument Connections { get; set; } = JsonDocument.Parse("[]");
    
    public double X { get; set; } = 0;
    public double Y { get; set; } = 0;
    
    public DateTime? PostedAt { get; set; }
    
    [Column(TypeName = "jsonb")]
    public JsonDocument? PostedTo { get; set; }
    
    [MaxLength(255)]
    public string? TweetId { get; set; }
    
    [MaxLength(500)]
    public string? SelectedImageUrl { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    [ForeignKey(nameof(UserId))]
    public virtual User User { get; set; } = null!;
}